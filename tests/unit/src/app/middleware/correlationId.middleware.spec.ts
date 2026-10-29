import type { Request, Response } from "express";

import {
  CORRELATION_ID_HEADER,
  correlationId,
} from "#/app/middleware/correlationId.middleware.js";
import { expect } from "chai";
import sinon from "sinon";

const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/;

function run(header?: string): {
  next: sinon.SinonStub;
  req: Request;
  res: { set: sinon.SinonStub };
} {
  const headers: Record<string, string> = {};
  if (header !== undefined) {
    headers[CORRELATION_ID_HEADER] = header;
  }
  const req = {
    get: (name: string) => headers[name.toLowerCase()],
    headers,
  } as unknown as Request;
  const res = { set: sinon.stub() };
  const next = sinon.stub();
  correlationId()(req, res as unknown as Response, next);
  return { next, req, res };
}

describe("correlationId middleware", () => {
  it("keeps a valid incoming correlation ID", () => {
    const { next, req, res } = run("abc-123");

    expect(req.correlationId).to.equal("abc-123");
    expect(req.headers[CORRELATION_ID_HEADER]).to.equal("abc-123");
    expect(res.set.calledWith("X-Correlation-Id", "abc-123")).to.equal(true);
    expect(next.calledOnce).to.equal(true);
  });

  it("generates a correlation ID when the header is missing", () => {
    const { req, res } = run();

    expect(req.correlationId).to.match(UUID_PATTERN);
    expect(req.headers[CORRELATION_ID_HEADER]).to.equal(req.correlationId);
    expect(res.set.calledWith("X-Correlation-Id", req.correlationId)).to.equal(
      true,
    );
  });

  it("replaces an invalid correlation ID", () => {
    for (const invalid of ["a\nb", "x".repeat(129), ""]) {
      const { req } = run(invalid);

      expect(req.correlationId).to.match(UUID_PATTERN);
    }
  });
});
