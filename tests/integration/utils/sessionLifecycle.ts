import type { Application } from "express";
import type { SinonFakeTimers } from "sinon";

import { createClient, type RedisClientType } from "redis";
import request from "supertest";
import { expect } from "chai";
import type { SessionData } from "express-session";
import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from "testcontainers";

import { getMsalCacheKey } from "#/auth/msal.cache.js";
import config from "#/config.js";
import { OK } from "#/lib/constants/http.js";
import { HOUR, MINUTE, SECOND } from "#/lib/constants/time.js";
import { createRedisClient } from "#/lib/redis.js";

const REDIS_PORT = 6379;
const TEST_TOKEN_LIFETIME_MS = 24 * HOUR;
const SESSION_ACTIVITY_INTERVAL_MS = 25 * MINUTE;

export interface SessionLifecycleRedisEnvironment {
  firstRedisClient: RedisClientType;
  secondRedisClient: RedisClientType;
  clear(): Promise<void>;
  stop(): Promise<void>;
}

export async function createSessionLifecycleRedisEnvironment(): Promise<SessionLifecycleRedisEnvironment> {
  const originalRedisEnabled = config.redis.enabled;
  const originalRedisUrl = config.redis.url;
  const container: StartedTestContainer = await new GenericContainer(
    "redis:7-alpine",
  )
    .withExposedPorts(REDIS_PORT)
    .withWaitStrategy(Wait.forLogMessage("Ready to accept connections"))
    .start();

  const redisUrl = `redis://localhost:${container.getMappedPort(REDIS_PORT)}`;
  config.redis.url = redisUrl;
  config.redis.enabled = true;

  const firstRedisClient = createClient({ url: redisUrl });
  const secondRedisClient = createClient({ url: redisUrl });
  const cacheRedisClient = createRedisClient(config.redis);
  const clients = [firstRedisClient, secondRedisClient, cacheRedisClient];

  try {
    await Promise.all(clients.map((client) => client.connect()));
  } catch (error) {
    await Promise.all(
      clients.map(async (client) => {
        if (client.isOpen) await client.quit();
      }),
    );
    config.redis.enabled = originalRedisEnabled;
    config.redis.url = originalRedisUrl;
    await container.stop();
    throw error;
  }

  return {
    firstRedisClient,
    secondRedisClient,
    clear: async () => {
      await firstRedisClient.flushDb();
    },
    stop: async () => {
      try {
        await Promise.all(
          clients.map(async (client) => {
            if (client.isOpen) await client.quit();
          }),
        );
      } finally {
        config.redis.enabled = originalRedisEnabled;
        config.redis.url = originalRedisUrl;
        await container.stop();
      }
    },
  };
}

export async function createAuthenticatedSession(
  app: Application,
  redisClient: RedisClientType,
): Promise<{ cookie: string; sessionId: string }> {
  const response = await request(app).get("/test/signin");
  const cookie = getSessionCookie(response.headers["set-cookie"]);
  const sessionKey = (await redisClient.keys("sess:*"))[0];
  const sessionId = sessionKey?.slice("sess:".length);

  expect(response.status).to.equal(OK);
  expect(cookie).to.be.a("string");
  expect(sessionId).to.be.a("string");

  return { cookie: cookie!, sessionId: sessionId! };
}

export async function createAuthenticatedSessionWithCache(
  app: Application,
  redisClient: RedisClientType,
): Promise<{ cookie: string; msalCacheKey: string; sessionId: string }> {
  const { cookie, sessionId } = await createAuthenticatedSession(
    app,
    redisClient,
  );
  await extendTestTokenExpiry(redisClient, sessionId);
  const msalCacheKey = getMsalCacheKey(sessionId);
  await redisClient.set(msalCacheKey, "synthetic-cache", {
    EX: config.redis.maxAge,
  });

  return { cookie, msalCacheKey, sessionId };
}

export function getSessionCookieHeader(
  value: string | string[] | undefined,
): string | undefined {
  const cookies =
    value === undefined ? [] : Array.isArray(value) ? value : [value];
  return cookies.find((cookie) => cookie.startsWith(`${config.session.name}=`));
}

export async function getLastActivityAt(
  redisClient: RedisClientType,
  sessionId: string,
): Promise<number | undefined> {
  const storedSession = await redisClient.get(`sess:${sessionId}`);
  if (storedSession === null) return;

  return (JSON.parse(storedSession) as { lastActivityAt?: number })
    .lastActivityAt;
}

export async function keepSessionActiveUntil(
  clock: SinonFakeTimers,
  app: Application,
  cookie: string,
  authenticatedAt: number,
  targetElapsed: number,
): Promise<void> {
  for (
    let elapsed = SESSION_ACTIVITY_INTERVAL_MS;
    elapsed < targetElapsed;
    elapsed += SESSION_ACTIVITY_INTERVAL_MS
  ) {
    clock.setSystemTime(authenticatedAt + elapsed);
    const response = await request(app).get("/").set("Cookie", cookie);
    expect(response.status).to.equal(OK);
  }
}

async function extendTestTokenExpiry(
  redisClient: RedisClientType,
  sessionId: string,
): Promise<void> {
  const sessionKey = `sess:${sessionId}`;
  const storedSession = await redisClient.get(sessionKey);
  if (storedSession === null) {
    throw new Error("Cannot extend a missing test session");
  }

  const session = JSON.parse(storedSession) as SessionData;
  if (session.account?.idTokenClaims === undefined) {
    throw new Error("Cannot extend a test session without an account");
  }

  const expiresAt = await redisClient.pExpireTime(sessionKey);
  if (expiresAt <= 0) {
    throw new Error("Cannot extend a test session without an expiry");
  }

  session.account.idTokenClaims.exp = Math.floor(
    (Date.now() + TEST_TOKEN_LIFETIME_MS) / SECOND,
  );
  await redisClient.set(sessionKey, JSON.stringify(session), {
    PXAT: expiresAt,
  });
}

function getSessionCookie(
  value: string | string[] | undefined,
): string | undefined {
  return getSessionCookieHeader(value)?.split(";", 1)[0];
}
