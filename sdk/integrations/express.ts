/**
 * Express integration for zkLogin Salt Server.
 *
 * Usage:
 * ```typescript
 * import express from 'express';
 * import { createSaltRouter } from 'zklogin-salt-server/sdk/integrations/express';
 *
 * const app = express();
 * app.use('/zklogin', createSaltRouter({ provider: { type: 'mysten' } }));
 * ```
 */

import type { Router, Request, Response, NextFunction } from "express";

export interface ExpressIntegrationOptions {
  provider:
    | { type: "mysten" }
    | { type: "local"; seed: string }
    | { type: "custom"; endpoint: string };
}

export function createSaltRouter(_options: ExpressIntegrationOptions): Router {
  // TODO: Implement Express router integration
  throw new Error("Express integration not yet implemented");
}

export function saltMiddleware(
  _options: ExpressIntegrationOptions
): (req: Request, res: Response, next: NextFunction) => void {
  // TODO: Implement Express middleware
  throw new Error("Express middleware not yet implemented");
}
