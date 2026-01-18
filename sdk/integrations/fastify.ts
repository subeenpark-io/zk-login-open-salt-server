/**
 * Fastify integration for zkLogin Salt Server.
 *
 * Usage:
 * ```typescript
 * import Fastify from 'fastify';
 * import { saltPlugin } from 'zklogin-salt-server/sdk/integrations/fastify';
 *
 * const fastify = Fastify();
 * fastify.register(saltPlugin, { provider: { type: 'mysten' } });
 * ```
 */

import type { FastifyPluginCallback } from "fastify";

export interface FastifyIntegrationOptions {
  provider:
    | { type: "mysten" }
    | { type: "local"; seed: string }
    | { type: "custom"; endpoint: string };
  prefix?: string;
}

export const saltPlugin: FastifyPluginCallback<FastifyIntegrationOptions> = (
  _fastify,
  _options,
  done
) => {
  // TODO: Implement Fastify plugin
  done(new Error("Fastify integration not yet implemented"));
};
