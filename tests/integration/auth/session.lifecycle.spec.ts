import type { Application } from "express";
import type { SinonFakeTimers } from "sinon";

import request from "supertest";
import { expect } from "chai";
import sinon from "sinon";

import createApp from "#/app.js";
import {
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_IDLE_TIMEOUT_MS,
} from "#/auth/session.lifecycle.js";
import { FOUND, OK } from "#/lib/constants/http.js";
import { MINUTE } from "#/lib/constants/time.js";
import {
  createAuthenticatedSessionWithCache,
  createSessionLifecycleRedisEnvironment,
  getLastActivityAt,
  getSessionCookieHeader,
  keepSessionActiveUntil,
  type SessionLifecycleRedisEnvironment,
} from "#tests/integration/utils/sessionLifecycle.js";
import { createConnectedRedisStore } from "#tests/integration/utils/redisSessionApp.js";

const TEN_MINUTE_MARGIN_MS = 10 * MINUTE;

let app: Application;
let secondApp: Application;
let redisEnvironment: SessionLifecycleRedisEnvironment;
let originalNodeEnv: string | undefined;
let originalTestSignin: string | undefined;

describe("authenticated session lifecycle with Redis", () => {
  before(async function () {
    this.timeout(300_000);
    originalNodeEnv = process.env.NODE_ENV;
    originalTestSignin = process.env.PLAYWRIGHT_TEST_SIGNIN;
    redisEnvironment = await createSessionLifecycleRedisEnvironment();
    process.env.NODE_ENV = "test";
    process.env.PLAYWRIGHT_TEST_SIGNIN = "true";

    app = await createApp({
      createRedisStore: createConnectedRedisStore,
      getRedisClient: () => redisEnvironment.firstRedisClient,
    });
    secondApp = await createApp({
      createRedisStore: createConnectedRedisStore,
      getRedisClient: () => redisEnvironment.secondRedisClient,
    });
  });

  after(async () => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalTestSignin === undefined) {
      delete process.env.PLAYWRIGHT_TEST_SIGNIN;
    } else {
      process.env.PLAYWRIGHT_TEST_SIGNIN = originalTestSignin;
    }

    await redisEnvironment?.stop();
  });

  afterEach(async () => {
    sinon.restore();
    await redisEnvironment.clear();
  });

  describe("idle timeout", () => {
    let clock: SinonFakeTimers;
    let cookie: string;
    let msalCacheKey: string;
    let sessionId: string;

    beforeEach(async () => {
      clock = sinon.useFakeTimers({ now: Date.now(), toFake: ["Date"] });
      ({ cookie, msalCacheKey, sessionId } =
        await createAuthenticatedSessionWithCache(
          app,
          redisEnvironment.firstRedisClient,
        ));
    });

    it("rejects an idle session and clears its session and cache", async () => {
      clock.setSystemTime(clock.now + SESSION_IDLE_TIMEOUT_MS + 1);

      const response = await request(secondApp)
        .get("/")
        .set("Cookie", cookie);

      expect(response.status).to.equal(FOUND);
      expect(response.headers.location).to.equal("/auth/signin?prompt=login");
      expect(
        await redisEnvironment.firstRedisClient.exists(`sess:${sessionId}`),
      ).to.equal(0);
      expect(
        await redisEnvironment.firstRedisClient.exists(msalCacheKey),
      ).to.equal(0);
    });
  });

  describe("absolute timeout", () => {
    let authenticatedAt: number;
    let clock: SinonFakeTimers;
    let cookie: string;
    let msalCacheKey: string;
    let sessionId: string;

    beforeEach(async () => {
      clock = sinon.useFakeTimers({ now: Date.now(), toFake: ["Date"] });
      authenticatedAt = clock.now;
      ({ cookie, msalCacheKey, sessionId } =
        await createAuthenticatedSessionWithCache(
          app,
          redisEnvironment.firstRedisClient,
        ));
      await keepSessionActiveUntil(
        clock,
        app,
        cookie,
        authenticatedAt,
        SESSION_ABSOLUTE_TIMEOUT_MS - TEN_MINUTE_MARGIN_MS,
      );
    });

    it("caps cookie, session, and cache expiry at the absolute deadline", async () => {
      clock.setSystemTime(
        authenticatedAt +
          SESSION_ABSOLUTE_TIMEOUT_MS -
          TEN_MINUTE_MARGIN_MS,
      );
      const response = await request(app).get("/").set("Cookie", cookie);

      expect(response.status).to.equal(OK);
      expect(getSessionCookieHeader(response.headers["set-cookie"])).to.include(
        `Expires=${new Date(clock.now + TEN_MINUTE_MARGIN_MS).toUTCString()}`,
      );
      expect(
        await redisEnvironment.firstRedisClient.pExpireTime(msalCacheKey),
      ).to.equal(clock.now + TEN_MINUTE_MARGIN_MS);
      expect(
        await redisEnvironment.firstRedisClient.ttl(`sess:${sessionId}`),
      ).to.be.within(599, 600);
      expect(
        await getLastActivityAt(
          redisEnvironment.firstRedisClient,
          sessionId,
        ),
      ).to.equal(clock.now);
    });

    it("rejects requests after the absolute deadline despite recent activity", async () => {
      clock.setSystemTime(authenticatedAt + SESSION_ABSOLUTE_TIMEOUT_MS + 1);
      const response = await request(secondApp).get("/").set("Cookie", cookie);

      expect(response.status).to.equal(FOUND);
      expect(response.headers.location).to.equal("/auth/signin?prompt=login");
      expect(
        await redisEnvironment.firstRedisClient.exists(`sess:${sessionId}`),
      ).to.equal(0);
      expect(
        await redisEnvironment.firstRedisClient.exists(msalCacheKey),
      ).to.equal(0);
    });
  });
});
