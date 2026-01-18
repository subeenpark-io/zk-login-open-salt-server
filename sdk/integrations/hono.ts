/**
 * Hono integration for zkLogin Salt Server.
 *
 * Usage:
 * ```typescript
 * import { Hono } from 'hono';
 * import { createSaltApp } from 'zklogin-salt-server/sdk/integrations/hono';
 *
 * const app = new Hono();
 * app.route('/zklogin', createSaltApp({ provider: { type: 'mysten' } }));
 * ```
 */

import { Hono } from "hono";
import { SaltClient } from "../core/salt-client.js";

export interface HonoIntegrationOptions {
  provider:
    | { type: "mysten" }
    | { type: "local"; seed: string }
    | { type: "custom"; endpoint: string };
}

export function createSaltApp(options: HonoIntegrationOptions): Hono {
  const app = new Hono();
  const client = createClient(options);

  app.post("/salt", async (c) => {
    const body = await c.req.json<{ jwt?: string }>();

    if (!body.jwt) {
      return c.json({ error: "missing_jwt", message: "JWT is required" }, 400);
    }

    try {
      const result = await client.getSalt(body.jwt);
      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: "salt_error", message }, 500);
    }
  });

  return app;
}

function createClient(options: HonoIntegrationOptions): SaltClient {
  switch (options.provider.type) {
    case "mysten":
      return SaltClient.mysten();
    case "local":
      return SaltClient.local({ seed: options.provider.seed });
    case "custom":
      return SaltClient.custom(options.provider.endpoint);
  }
}
