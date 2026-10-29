import type { Request, Response } from "express";

import { requestLogger } from "#/app/middleware/requestLogger.middleware.js";
import { AppLogger } from "#/logger.js";
import { expect } from "chai";
import sinon from "sinon";

describe("requestLogger middleware", () => {
  it("attaches a child logger to the request and calls next", () => {
    const req = { correlationId: "abc-123" } as unknown as Request;
    const next = sinon.stub();

    requestLogger()(req, {} as Response, next);

    expect(req.log).to.be.instanceOf(AppLogger);
    expect(next.calledOnce).to.equal(true);
  });

  it("creates a distinct logger per request", () => {
    const first = { correlationId: "a" } as unknown as Request;
    const second = { correlationId: "b" } as unknown as Request;

    requestLogger()(first, {} as Response, sinon.stub());
    requestLogger()(second, {} as Response, sinon.stub());

    expect(first.log).to.not.equal(second.log);
  });
});
