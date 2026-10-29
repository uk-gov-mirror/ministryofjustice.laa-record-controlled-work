import type { NextFunction, Request, RequestHandler, Response } from "express";

import { logger } from "#/logger.js";

/**
 * Attaches a request-scoped child logger to `req.log` carrying the correlation ID.
 * Must run after the correlationId middleware.
 * @returns {RequestHandler} The requestLogger middleware function.
 */
export function requestLogger(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.log = logger.child({ correlationId: req.correlationId });
    next();
  };
}
