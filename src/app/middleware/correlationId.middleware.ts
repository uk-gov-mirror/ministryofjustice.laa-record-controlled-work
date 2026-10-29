import type { NextFunction, Request, RequestHandler, Response } from "express";

import { randomUUID } from "node:crypto";

export const CORRELATION_ID_HEADER = "x-correlation-id";

const VALID_CORRELATION_ID = /^[\w.-]{1,128}$/;

/**
 * Resolves the request correlation ID from the NGINX header, generating one when it is missing or invalid.
 * @returns {RequestHandler} The correlationId middleware function.
 */
export function correlationId(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.get(CORRELATION_ID_HEADER);
    const id =
      incoming !== undefined && VALID_CORRELATION_ID.test(incoming)
        ? incoming
        : randomUUID();

    // Written back so existing `x-correlation-id` readers see the fallback too.
    req.headers[CORRELATION_ID_HEADER] = id;
    req.correlationId = id;
    res.set("X-Correlation-Id", id);
    next();
  };
}
