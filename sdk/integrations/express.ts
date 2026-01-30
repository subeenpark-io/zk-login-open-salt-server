/**
 * Express integration for zkLogin Salt Server.
 *
 * Usage:
 * ```typescript
 * import express from 'express';
 * import { createSaltRouter } from 'zklogin-salt-server/sdk/integrations/express';
 *
 * const app = express();
 * app.use(express.json());
 * app.use('/zklogin', await createSaltRouter({ provider: { type: 'mysten' } }));
 * ```
 *
 * Note: express must be installed as a peer dependency.
 */

import { SaltClient } from "../core/salt-client.js";

export interface ExpressIntegrationOptions {
  provider:
    | { type: "mysten" }
    | { type: "local"; seed: string }
    | { type: "custom"; endpoint: string };
}

// Generic types for Express compatibility without requiring @types/express
interface ExpressRequest {
  body?: { jwt?: string };
  saltClient?: SaltClient;
}

interface ExpressResponse {
  status(code: number): ExpressResponse;
  json(data: unknown): void;
}

type ExpressNextFunction = () => void;

interface ExpressRouter {
  post(
    path: string,
    handler: (req: ExpressRequest, res: ExpressResponse) => void | Promise<void>
  ): void;
}

interface ExpressModule {
  Router(): ExpressRouter;
}

/**
 * Create an Express router with the /salt endpoint.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createSaltRouter } from 'zklogin-salt-server/sdk/integrations/express';
 *
 * const app = express();
 * app.use(express.json());
 * app.use('/zklogin', await createSaltRouter({ provider: { type: 'mysten' } }));
 * // POST /zklogin/salt with { "jwt": "..." } to get salt
 * ```
 */
export async function createSaltRouter(options: ExpressIntegrationOptions): Promise<ExpressRouter> {
  let express: ExpressModule;
  try {
    express = (await import("express")).default as unknown as ExpressModule;
  } catch {
    throw new Error(
      "Express is not installed. Please install express as a dependency: npm install express"
    );
  }

  const router = express.Router();
  const client = createClient(options);

  router.post("/salt", async (req: ExpressRequest, res: ExpressResponse) => {
    if (!req.body?.jwt) {
      res.status(400).json({
        error: "missing_jwt",
        message: "JWT is required",
      });
      return;
    }

    try {
      const result = await client.getSalt(req.body.jwt);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "salt_error",
        message,
      });
    }
  });

  return router;
}

/**
 * Express middleware that injects a SaltClient into the request object.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { saltMiddleware } from 'zklogin-salt-server/sdk/integrations/express';
 *
 * const app = express();
 * app.use(saltMiddleware({ provider: { type: 'mysten' } }));
 *
 * app.post('/my-endpoint', async (req, res) => {
 *   const { salt } = await req.saltClient.getSalt(jwt);
 *   // use salt...
 * });
 * ```
 */
export function saltMiddleware(
  options: ExpressIntegrationOptions
): (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => void {
  const client = createClient(options);

  return (req: ExpressRequest, _res: ExpressResponse, next: ExpressNextFunction): void => {
    req.saltClient = client;
    next();
  };
}

function createClient(options: ExpressIntegrationOptions): SaltClient {
  switch (options.provider.type) {
    case "mysten":
      return SaltClient.mysten();
    case "local":
      return SaltClient.local({ seed: options.provider.seed });
    case "custom":
      return SaltClient.custom(options.provider.endpoint);
  }
}

// Re-export SaltClient for convenience
export { SaltClient };
