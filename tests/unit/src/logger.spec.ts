import * as Sentry from "@sentry/node";
import { setTimeout } from "node:timers/promises";

import {
  getCorrelationId,
  runWithRequestContext,
} from "#/lib/requestContext.js";
import { AppLogger, createLogger, type LogContext } from "#/logger.js";
import { expect } from "chai";
import sinon from "sinon";

function captureLogs(context: LogContext = {}): {
  lines: Record<string, unknown>[];
  log: AppLogger;
  rawLines: string[];
} {
  const lines: Record<string, unknown>[] = [];
  const rawLines: string[] = [];
  const log = createLogger(context, {
    write: (line: string) => {
      rawLines.push(line);
      lines.push(JSON.parse(line) as Record<string, unknown>);
    },
  });
  return { lines, log, rawLines };
}

describe("logger", () => {
  beforeEach(() => {
    sinon.stub(process, "env").value({ ...process.env, LOG_LEVEL: "debug" });
  });

  afterEach(() => sinon.restore());

  it("emits the standard shape with flat fields", () => {
    const { lines, log } = captureLogs({ correlationId: "abc" });

    log.info("application.created", { applicationId: "1", statusCode: 201 });

    expect(lines[0]).to.include({
      applicationId: "1",
      correlationId: "abc",
      level: "INFO",
      message: "application.created",
      service: "record-controlled-work",
      statusCode: 201,
    });
    expect(lines[0]).to.have.property("environment");
    expect(lines[0]).to.not.have.property("context");
    expect(lines[0]?.timestamp).to.match(/^\d{4}-\d{2}-\d{2}T[\d:]+\.\d{3}Z$/);
  });

  it("redacts sensitive fields", () => {
    const { lines, log } = captureLogs();

    log.warn("test", { token: "secret", nested: { password: "p" } });

    expect(lines[0]).to.include({ token: "***" });
    expect(lines[0]?.nested).to.deep.equal({ password: "***" });
  });

  it("serialises the error", () => {
    const { lines, log } = captureLogs();

    log.error("failed", new Error("boom"));

    expect((lines[0]?.err as { message: string }).message).to.equal("boom");
  });

  for (const level of ["debug", "info", "warn", "error", "fatal"] as const) {
    it(`enriches ${level} output and Sentry attributes from async context`, () => {
      const { lines, log } = captureLogs();
      const sentryLog = sinon.stub(Sentry.logger, level);
      const captureException = sinon.stub(
        Sentry.getCurrentScope(),
        "captureException",
      );
      const error = new Error("dependency unavailable");
      const fields = { operation: "test", token: "sensitive-value" };

      runWithRequestContext({ correlationId: "request-123" }, () => {
        if (level === "error" || level === "fatal") {
          log[level]("dependency.failed", error, fields);
        } else {
          log[level]("dependency.failed", fields);
        }
      });

      expect(lines[0]).to.include({
        correlationId: "request-123",
        level: level.toUpperCase(),
        operation: "test",
        token: "***",
      });
      expect(
        sentryLog.calledOnceWithExactly("dependency.failed", {
          correlationId: "request-123",
          operation: "test",
          token: "***",
        }),
      ).to.equal(true);
      if (level === "error" || level === "fatal") {
        expect(
          captureException.calledOnceWithExactly(error, {
            captureContext: {
              extra: {
                correlationId: "request-123",
                message: "dependency.failed",
                operation: "test",
                token: "***",
              },
            },
          }),
        ).to.equal(true);
      } else {
        expect(captureException.called).to.equal(false);
      }
      expect(fields).to.deep.equal({
        operation: "test",
        token: "sensitive-value",
      });
    });
  }

  it("uses the active ID over parent, child and explicit IDs without duplicate JSON keys", () => {
    const { lines, log, rawLines } = captureLogs({
      applicationId: "application-1",
      correlationId: "parent-id",
    });
    const child = log
      .child({ correlationId: "child-id", userId: "test-user" })
      .child({ applicationId: "application-2" });
    const sentryLog = sinon.stub(Sentry.logger, "info");

    runWithRequestContext({ correlationId: "active-id" }, () => {
      child.info("application.updated", { correlationId: "explicit-id" });
    });

    expect(lines[0]).to.include({
      applicationId: "application-2",
      correlationId: "active-id",
      userId: "test-user",
    });
    expect(sentryLog.firstCall.args[1]).to.deep.equal({
      applicationId: "application-2",
      correlationId: "active-id",
      userId: "test-user",
    });
    expect(rawLines[0]?.match(/"correlationId":/g)).to.have.lengthOf(1);
  });

  it("preserves explicit and child IDs outside a request and otherwise omits the ID", () => {
    const { lines, log } = captureLogs();
    const child = log.child({ correlationId: "operation-id" });

    child.info("operation.started");
    child.warn("operation.updated", { correlationId: "explicit-id" });
    log.info("service.started");

    expect(lines[0]?.correlationId).to.equal("operation-id");
    expect(lines[1]?.correlationId).to.equal("explicit-id");
    expect(lines[2]).not.to.have.property("correlationId");
  });

  it("keeps overlapping async operations isolated and resolves IDs at log time", async () => {
    const { lines, log } = captureLogs();
    const child = log.child({ applicationId: "application-1" });
    let releaseFirst = (): void => {
      throw new Error("First operation has not started");
    };
    const firstReady = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    await Promise.all([
      runWithRequestContext({ correlationId: "first" }, async () => {
        child.info("first.started");
        await firstReady;
        await setTimeout(0);
        child.warn("first.finished");
      }),
      runWithRequestContext({ correlationId: "second" }, async () => {
        await Promise.resolve();
        child.info("second.started");
        releaseFirst();
        await setTimeout(0);
        child.error("second.finished", new Error("dependency unavailable"));
      }),
    ]);
    log.info("outside");

    expect(
      lines.map(({ correlationId, message }) => [message, correlationId]),
    ).to.have.deep.members([
      ["first.started", "first"],
      ["first.finished", "first"],
      ["second.started", "second"],
      ["second.finished", "second"],
      ["outside", undefined],
    ]);
    expect(getCorrelationId()).to.equal(undefined);
  });
});
