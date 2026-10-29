/* eslint-disable jsdoc/require-jsdoc -- logger API is intentionally compact and self-explanatory. */

import * as Sentry from "@sentry/node";
import pino, { type DestinationStream, type Logger } from "pino";

export interface LogContext {
  applicationId?: string;
  correlationId?: string;
  userId?: string;
}

export interface LogFields extends Record<string, unknown> {
  applicationId?: string;
  dependency?: string;
  durationMs?: number;
  operation?: string;
  retryAttempt?: number;
  statusCode?: number;
}

const SERVICE_NAME = "record-controlled-work";

const SENSITIVE_FIELD_NAMES = new Set([
  "accessToken",
  "address",
  "apiKey",
  "authorization",
  "cookie",
  "dateOfBirth",
  "firstName",
  "headers.authorization",
  "headers.cookie",
  "idToken",
  "lastName",
  "niNumber",
  "password",
  "refreshToken",
  "req.headers.authorization",
  "req.headers.cookie",
  "secret",
  "token",
]);

// top-level and one-level-nested matches, as pino redact paths cannot be recursive
const REDACT_PATHS = [...SENSITIVE_FIELD_NAMES].flatMap((name) => [
  name,
  `*.${name}`,
]);

export class AppLogger {
  constructor(
    private readonly logger: Logger,
    private readonly context: LogContext = {},
  ) {}

  // creates a context-bound child logger
  child(context: LogContext): AppLogger {
    return new AppLogger(this.logger.child(context), {
      ...this.context,
      ...context,
    });
  }

  debug(message: string, fields: LogFields = {}): void {
    this.logger.debug(fields, message);
    Sentry.logger.debug(message, this.sentryAttributes(fields));
  }
  error(message: string, error?: unknown, fields: LogFields = {}): void {
    this.logger.error({ ...fields, err: error }, message);
    this.sendErrorToSentry(
      message,
      error,
      fields,
      Sentry.logger.error.bind(Sentry.logger),
    );
  }
  fatal(message: string, error: unknown, fields: LogFields = {}): void {
    this.logger.fatal({ ...fields, err: error }, message);
    this.sendErrorToSentry(
      message,
      error,
      fields,
      Sentry.logger.fatal.bind(Sentry.logger),
    );
  }
  info(message: string, fields: LogFields = {}): void {
    this.logger.info(fields, message);
    Sentry.logger.info(message, this.sentryAttributes(fields));
  }
  warn(message: string, fields: LogFields = {}): void {
    this.logger.warn(fields, message);
    Sentry.logger.warn(message, this.sentryAttributes(fields));
  }

  private sendErrorToSentry(
    message: string,
    error: unknown,
    fields: LogFields,
    sendLog: (message: string, attributes: Record<string, unknown>) => void,
  ): void {
    const attributes = this.sentryAttributes(fields);
    sendLog(message, attributes);
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: { ...attributes, message } });
    }
  }

  private sentryAttributes(fields: LogFields): Record<string, unknown> {
    return { ...this.context, ...redactSensitiveFields(fields) };
  }
}

export function createLogger(
  context: LogContext = {},
  destination?: DestinationStream,
): AppLogger {
  return new AppLogger(
    pino(
      {
        base: {
          environment: process.env.NODE_ENV,
          service: SERVICE_NAME,
        },
        formatters: {
          level: (label): Record<string, string> => ({
            level: label.toUpperCase(),
          }),
        },
        level: process.env.LOG_LEVEL ?? "info",
        messageKey: "message",
        redact: {
          censor: "***",
          paths: REDACT_PATHS,
        },
        timestamp,
      },
      destination,
    ).child(context),
    context,
  );
}

function redactSensitiveFields(value: unknown): Record<string, unknown>;
function redactSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveFields);
  }
  if (
    value !== null &&
    typeof value === "object" &&
    !(value instanceof Error)
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        SENSITIVE_FIELD_NAMES.has(key) ? "***" : redactSensitiveFields(nested),
      ]),
    );
  }
  return value;
}

export const logger = createLogger();

function timestamp(): string {
  return `,"timestamp":"${new Date().toISOString()}"`;
}
