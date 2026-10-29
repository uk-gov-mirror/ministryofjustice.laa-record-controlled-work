import type { Application } from "express";
import type { SinonFakeTimers } from "sinon";
import type { RedisClientType } from "redis";

import request from "supertest";
import { expect } from "chai";
import sinon from "sinon";

import {
  createEligibilityRouter,
  type EligibilityRouterDeps,
} from "#/api/eligibility/eligibility.routes.js";
import { requireAuth } from "#/auth/middleware/requireAuth.middleware.js";
import { SESSION_IDLE_TIMEOUT_MS } from "#/auth/session.lifecycle.js";
import {
  createAuthenticatedSessionWithCache,
  createSessionLifecycleRedisEnvironment,
  getLastActivityAt,
  getSessionCookieHeader,
  type SessionLifecycleRedisEnvironment,
} from "#tests/integration/utils/sessionLifecycle.js";
import { createRedisSessionTestApp } from "#tests/integration/utils/redisSessionApp.js";
import { OK } from "#/lib/constants/http.js";
import { MINUTE } from "#/lib/constants/time.js";
import {
  getGetApplicationResponseMock,
} from "#orval/mocks/rcw/fakers/applications/applications.faker.gen.js";

const APPLICATION_ID = "123e4567-e89b-12d3-a456-426614174000";

let redisEnvironment: SessionLifecycleRedisEnvironment;

describe("eligibility activity renews authenticated sessions", () => {
  let clock: SinonFakeTimers;
  let dependencies: {
    getApplication: sinon.SinonStub;
    updateApplicationMeans: sinon.SinonStub;
  };
  let firstApp: Application;
  let secondApp: Application;

  before(async function () {
    this.timeout(300_000);
    redisEnvironment = await createSessionLifecycleRedisEnvironment();
  });

  after(async () => {
    await redisEnvironment?.stop();
  });

  afterEach(async () => {
    sinon.restore();
    await redisEnvironment.clear();
  });

  beforeEach(() => {
    clock = sinon.useFakeTimers({ now: Date.now(), toFake: ["Date"] });
    dependencies = buildEligibilityDependencies();
    firstApp = createEligibilityTestApp(
      redisEnvironment.firstRedisClient,
      dependencies,
    );
    secondApp = createEligibilityTestApp(
      redisEnvironment.secondRedisClient,
      dependencies,
    );
  });

  it("renews activity from GET requests across replicas", async () => {
    const { cookie, msalCacheKey, sessionId } =
      await createAuthenticatedSessionWithCache(
        firstApp,
        redisEnvironment.firstRedisClient,
      );
    clock.setSystemTime(clock.now + 20 * MINUTE);

    const response = await request(secondApp)
      .get(`/api/applications/${APPLICATION_ID}/eligibility`)
      .set("Cookie", cookie);

    expect(response.status).to.equal(OK);
    expect(getSessionCookieHeader(response.headers["set-cookie"])).to.be.a(
      "string",
    );
    expect(
      await getLastActivityAt(redisEnvironment.firstRedisClient, sessionId),
    ).to.equal(clock.now);
    expect(
      await redisEnvironment.firstRedisClient.pExpireTime(msalCacheKey),
    ).to.equal(clock.now + SESSION_IDLE_TIMEOUT_MS);
  });

  it("renews activity from PUT requests", async () => {
    const { cookie, msalCacheKey, sessionId } =
      await createAuthenticatedSessionWithCache(
        firstApp,
        redisEnvironment.firstRedisClient,
      );
    clock.setSystemTime(clock.now + 20 * MINUTE);

    const response = await request(firstApp)
      .put(`/api/applications/${APPLICATION_ID}/eligibility`)
      .set("Cookie", cookie)
      .send({
        eligibility_assessment: {
          api_response: { indication: true },
          level_of_help: "controlled_legal_representation",
        },
      });

    expect(response.status).to.equal(OK);
    expect(dependencies.updateApplicationMeans.calledOnce).to.be.true;
    expect(
      await getLastActivityAt(redisEnvironment.firstRedisClient, sessionId),
    ).to.equal(clock.now);
    expect(
      await redisEnvironment.firstRedisClient.pExpireTime(msalCacheKey),
    ).to.equal(clock.now + SESSION_IDLE_TIMEOUT_MS);
  });
});

function createEligibilityTestApp(
  redisClient: RedisClientType,
  dependencies: EligibilityRouterDeps,
): Application {
  const app = createRedisSessionTestApp(redisClient);
  app.use(
    "/api/applications/:applicationId/eligibility",
    requireAuth(),
    createEligibilityRouter(dependencies),
  );
  return app;
}

function buildEligibilityDependencies(): {
  getApplication: sinon.SinonStub;
  updateApplicationMeans: sinon.SinonStub;
} {
  const application = getGetApplicationResponseMock();
  const getApplication = sinon.stub().resolves({
    data: getGetApplicationResponseMock({
      id: APPLICATION_ID,
      clientDetails: {
        ...application.clientDetails,
        dateOfBirth: "1990-01-01",
      },
      eligibility: null,
    }),
    status: 200,
  });
  const updateApplicationMeans = sinon.stub().resolves({
    data: undefined,
    status: 204,
  });
  return { getApplication, updateApplicationMeans };
}
