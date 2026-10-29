import type session from "express-session";

import type { AuthFlowStore } from "#/auth/authCodeFlow/store.types.js";
import type { AppLogger } from "#/logger.js";

export interface ExpressLocaleLoader {
  t: (key: string, options?: Record<string, unknown>) => string;
}

declare global {
  namespace Express {
    interface Request {
      accessToken?: string;
      correlationId: string;
      locale: ExpressLocaleLoader;
      log: AppLogger;
      session: Partial<session.SessionData> & session.Session;
      user?: AccountInfo;
    }
  }
}

declare module "express-serve-static-core" {
  interface Locals {
    authFlowStore?: AuthFlowStore;
    csrfToken?: string;
  }
}
