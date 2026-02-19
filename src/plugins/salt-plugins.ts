import type { Context } from "hono";
import type { VerifiedJWT } from "../services/jwt.service.js";
import type { PluginsConfig } from "../types/index.js";

export interface SaltPluginContext {
  c: Context;
  jwt: string;
  verified: VerifiedJWT;
  audience: string;
}

export interface SaltRequestPlugin {
  name: string;
  run(context: SaltPluginContext): Promise<void> | void;
}

export class SaltPluginError extends Error {
  readonly code: string;
  readonly status: 401 | 403;

  constructor(code: string, message: string, status: 401 | 403) {
    super(message);
    this.name = "SaltPluginError";
    this.code = code;
    this.status = status;
  }
}

export function createSaltPlugins(config?: PluginsConfig): SaltRequestPlugin[] {
  const plugins: SaltRequestPlugin[] = [];

  if (config?.apiKeyAuth?.enabled) {
    plugins.push(createApiKeyAuthPlugin(config.apiKeyAuth));
  }

  if (config?.audAllowlist?.enabled) {
    plugins.push(createAudienceAllowlistPlugin(config.audAllowlist.audiences));
  }

  return plugins;
}

export async function runSaltPlugins(
  plugins: SaltRequestPlugin[],
  context: SaltPluginContext
): Promise<void> {
  for (const plugin of plugins) {
    await plugin.run(context);
  }
}

function createApiKeyAuthPlugin(config: NonNullable<PluginsConfig["apiKeyAuth"]>): SaltRequestPlugin {
  const headerName = config.headerName ?? "x-api-key";
  const valueEnvVar = config.valueEnvVar ?? "SALT_API_KEY";
  const expectedValue = config.value ?? process.env[valueEnvVar];

  if (!expectedValue) {
    throw new Error(
      `apiKeyAuth plugin enabled but no API key configured (set plugins.apiKeyAuth.value or ${valueEnvVar})`
    );
  }

  return {
    name: "apiKeyAuth",
    run: ({ c }) => {
      const apiKey = c.req.header(headerName);
      if (!apiKey || apiKey !== expectedValue) {
        throw new SaltPluginError("unauthorized", "API key is missing or invalid", 401);
      }
    },
  };
}

function createAudienceAllowlistPlugin(audiences: string[]): SaltRequestPlugin {
  if (audiences.length === 0) {
    throw new Error("audAllowlist plugin enabled but audiences list is empty");
  }

  return {
    name: "audAllowlist",
    run: ({ audience }) => {
      const allowed = audiences.some((pattern) => matchesPattern(pattern, audience));
      if (!allowed) {
        throw new SaltPluginError("audience_not_allowed", "JWT audience is not allowed", 403);
      }
    },
  };
}

function matchesPattern(pattern: string, value: string): boolean {
  const escapedPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  const regex = new RegExp(`^${escapedPattern}$`);
  return regex.test(value);
}
