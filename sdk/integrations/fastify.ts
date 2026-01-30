/**
 * Fastify integration for zkLogin Salt Server.
 *
 * Usage:
 * ```typescript
 * import Fastify from 'fastify';
 * import { saltPlugin } from 'zklogin-salt-server/sdk/integrations/fastify';
 *
 * const fastify = Fastify();
 * await fastify.register(saltPlugin, { provider: { type: 'mysten' } });
 * ```
 *
 * Note: fastify must be installed as a peer dependency.
 */

import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  FastifyInstance,
} from "fastify";
import { SaltClient } from "../core/salt-client.js";

export interface FastifyIntegrationOptions {
  provider:
    | { type: "mysten" }
    | { type: "local"; seed: string }
    | { type: "custom"; endpoint: string };
  /** Route prefix (default: "") */
  prefix?: string;
}

// Extend FastifyRequest to include saltClient
declare module "fastify" {
  interface FastifyRequest {
    saltClient?: SaltClient;
  }
}

interface SaltRequestBody {
  jwt?: string;
}

/**
 * Fastify plugin that adds the /salt endpoint.
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { saltPlugin } from 'zklogin-salt-server/sdk/integrations/fastify';
 *
 * const fastify = Fastify();
 * await fastify.register(saltPlugin, { provider: { type: 'mysten' } });
 * // POST /salt with { "jwt": "..." } to get salt
 *
 * // With prefix:
 * await fastify.register(saltPlugin, {
 *   provider: { type: 'mysten' },
 *   prefix: '/zklogin'
 * });
 * // POST /zklogin/salt
 * ```
 */
export const saltPlugin: FastifyPluginAsync<FastifyIntegrationOptions> = async (
  fastify: FastifyInstance,
  options: FastifyIntegrationOptions
) => {
  const client = createClient(options);
  const prefix = options.prefix ?? "";

  fastify.post<{ Body: SaltRequestBody }>(
    `${prefix}/salt`,
    async (request: FastifyRequest<{ Body: SaltRequestBody }>, reply: FastifyReply) => {
      const { jwt } = request.body ?? {};

      if (!jwt) {
        return reply.status(400).send({
          error: "missing_jwt",
          message: "JWT is required",
        });
      }

      try {
        const result = await client.getSalt(jwt);
        return reply.send(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          error: "salt_error",
          message,
        });
      }
    }
  );
};

/**
 * Fastify plugin that decorates requests with a SaltClient.
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { saltClientPlugin } from 'zklogin-salt-server/sdk/integrations/fastify';
 *
 * const fastify = Fastify();
 * await fastify.register(saltClientPlugin, { provider: { type: 'mysten' } });
 *
 * fastify.post('/my-endpoint', async (request, reply) => {
 *   const { salt } = await request.saltClient.getSalt(jwt);
 *   // use salt...
 * });
 * ```
 */
export const saltClientPlugin: FastifyPluginAsync<FastifyIntegrationOptions> = async (
  fastify: FastifyInstance,
  options: FastifyIntegrationOptions
) => {
  const client = createClient(options);

  fastify.decorateRequest("saltClient", null);

  fastify.addHook("onRequest", async (request: FastifyRequest) => {
    request.saltClient = client;
  });
};

function createClient(options: FastifyIntegrationOptions): SaltClient {
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
