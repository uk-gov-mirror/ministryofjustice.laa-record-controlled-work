import type { NextFunction, Request, RequestHandler, Response } from "express";

import { runWithRequestContext } from "#/lib/requestContext.js";

/**
 * Establishes async correlation context for downstream logging.
 * Must run after the correlationId middleware.
 * @returns {RequestHandler} The requestLogger middleware function.
 */
export function requestLogger(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    runWithRequestContext({ correlationId: String(req.correlationId) }, next);
  };
}
