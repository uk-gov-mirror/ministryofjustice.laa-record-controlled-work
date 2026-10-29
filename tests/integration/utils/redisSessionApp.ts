import type { Application } from "express";

import express from "express";
import session from "express-session";
import { RedisStore } from "connect-redis";
import type { RedisClientType } from "redis";

import testRoutes from "#/app/routes/test.js";
import config from "#/config.js";
import type { CreateRedisStore } from "#/lib/redis.js";

export const createConnectedRedisStore: CreateRedisStore = async (client) =>
  new RedisStore({ client });

export function createRedisSessionTestApp(
  redisClient: RedisClientType,
): Application {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      ...config.session,
      store: new RedisStore({ client: redisClient }),
    }),
  );
  app.use("/test", testRoutes);
  return app;
}
