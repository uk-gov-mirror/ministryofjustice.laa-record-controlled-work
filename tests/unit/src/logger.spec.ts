import { createLogger } from "#/logger.js";
import { expect } from "chai";

function captureLogs(context = {}): {
  lines: Record<string, unknown>[];
  log: ReturnType<typeof createLogger>;
} {
  const lines: Record<string, unknown>[] = [];
  const log = createLogger(context, {
    write: (line: string) => {
      lines.push(JSON.parse(line) as Record<string, unknown>);
    },
  });
  return { lines, log };
}

describe("logger", () => {
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
});
