import { expect } from "chai";
import { rejects } from "node:assert/strict";

import {
  getCorrelationId,
  runWithRequestContext,
} from "#/lib/requestContext.js";

describe("request context", () => {
  it("returns the callback result and restores the outer context", () => {
    expect(getCorrelationId()).to.equal(undefined);

    const result = runWithRequestContext({ correlationId: "outer" }, () => {
      expect(getCorrelationId()).to.equal("outer");
      runWithRequestContext({ correlationId: "inner" }, () => {
        expect(getCorrelationId()).to.equal("inner");
      });
      expect(getCorrelationId()).to.equal("outer");
      return "result";
    });

    expect(result).to.equal("result");
    expect(getCorrelationId()).to.equal(undefined);
  });

  it("propagates synchronous errors without retaining context", () => {
    const error = new Error("request failed");

    expect(() =>
      runWithRequestContext({ correlationId: "request" }, () => {
        throw error;
      }),
    ).to.throw(error);
    expect(getCorrelationId()).to.equal(undefined);
  });

  it("propagates asynchronous errors without retaining context", async () => {
    const error = new Error("request failed");
    const result = runWithRequestContext(
      { correlationId: "request" },
      async () => {
        await Promise.resolve();
        expect(getCorrelationId()).to.equal("request");
        throw error;
      },
    );

    await rejects(result, error);
    expect(getCorrelationId()).to.equal(undefined);
  });
});
