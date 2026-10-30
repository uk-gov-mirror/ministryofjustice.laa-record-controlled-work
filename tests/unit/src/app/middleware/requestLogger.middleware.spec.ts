import type { NextFunction, Request, Response } from "express";

import * as Sentry from "@sentry/node";
import { Router } from "express";
import request from "supertest";

import { correlationId } from "#/app/middleware/correlationId.middleware.js";
import { requestLogger } from "#/app/middleware/requestLogger.middleware.js";
import { INTERNAL_SERVER_ERROR, OK } from "#/lib/constants/http.js";
import { getCorrelationId } from "#/lib/requestContext.js";
import { logger } from "#/logger.js";
import { createMockApp } from "#tests/unit/utils.js";
import { expect } from "chai";
import sinon from "sinon";

describe("requestLogger middleware", () => {
  afterEach(() => sinon.restore());

  it("calls next within the request correlation context", () => {
    const req = { correlationId: "abc-123" } as unknown as Request;
    const next = sinon.spy(() => {
      expect(getCorrelationId()).to.equal("abc-123");
    });

    requestLogger()(req, {} as Response, next);

    expect(next.calledOnce).to.equal(true);
    expect(getCorrelationId()).to.equal(undefined);
  });

  it("uses each request's correlation ID without retaining the previous one", () => {
    const first = { correlationId: "a" } as unknown as Request;
    const second = { correlationId: "b" } as unknown as Request;

    const observed: (string | undefined)[] = [];
    const next = (): void => {
      observed.push(getCorrelationId());
    };
    requestLogger()(first, {} as Response, next);
    requestLogger()(second, {} as Response, next);

    expect(observed).to.deep.equal(["a", "b"]);
    expect(getCorrelationId()).to.equal(undefined);
  });

  it("makes the request ID available to downstream async work only", async () => {
    const req = { correlationId: "abc-123" } as unknown as Request;
    let downstream: Promise<void> | undefined;
    const next = (): void => {
      expect(getCorrelationId()).to.equal("abc-123");
      downstream = Promise.resolve().then(() => {
        expect(getCorrelationId()).to.equal("abc-123");
      });
    };

    requestLogger()(req, {} as Response, next);

    expect(getCorrelationId()).to.equal(undefined);
    await downstream;
    expect(getCorrelationId()).to.equal(undefined);
  });

  for (const incoming of ["incoming-id", undefined]) {
    it(`correlates shared logger calls with the response when the header is ${incoming === undefined ? "missing" : "present"}`, async () => {
      const sentryLog = sinon.stub(Sentry.logger, "info");
      const router = Router();
      router.use(correlationId(), requestLogger());
      router.get("/", async (_req, res) => {
        await Promise.resolve();
        logger.info("request.handled");
        res.sendStatus(OK);
      });
      const app = createMockApp({ router, useCsrf: false });
      const pending = request(app).get("/auth/");
      if (incoming !== undefined) {
        pending.set("X-Correlation-Id", incoming);
      }

      const response = await pending.expect(OK);
      const id: unknown = response.headers["x-correlation-id"];
      expect(id).to.be.a("string");
      if (incoming !== undefined) {
        expect(id).to.equal(incoming);
      }
      expect(sentryLog.calledOnce).to.equal(true);
      expect(sentryLog.firstCall.args[1]).to.include({ correlationId: id });
      expect(getCorrelationId()).to.equal(undefined);
    });
  }

  it("retains correlation for the async Express error boundary", async () => {
    const sentryLog = sinon.stub(Sentry.logger, "error");
    const router = Router();
    router.use(correlationId(), requestLogger());
    router.get("/", async () => {
      await Promise.resolve();
      throw new Error("request failed");
    });
    router.use(
      (error: Error, _req: Request, res: Response, _next: NextFunction) => {
        logger.error("request.failed", error);
        res.sendStatus(INTERNAL_SERVER_ERROR);
      },
    );
    const app = createMockApp({ router, useCsrf: false });

    await request(app)
      .get("/auth/")
      .set("X-Correlation-Id", "failed-request")
      .expect(INTERNAL_SERVER_ERROR);

    expect(sentryLog.firstCall.args[1]).to.include({
      correlationId: "failed-request",
    });
    expect(getCorrelationId()).to.equal(undefined);
  });
});
