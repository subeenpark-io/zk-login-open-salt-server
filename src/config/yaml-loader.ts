import { readFileSync, existsSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { AppConfig, ProviderConfig, SeedSource } from "../types/index.js";

const DEFAULT_CONFIG_PATHS = [
  "./config.yaml",
  "./config.yml",
  "./salt-server.yaml",
  "./salt-server.yml",
  "/etc/zklogin-salt-server/config.yaml",
];

export interface RawConfig {
  server?: {
    port?: number;
    host?: string;
  };
  logging?: {
    level?: string;
    format?: string;
  };
  security?: {
    corsOrigins?: string | string[];
    rateLimitMax?: number;
    rateLimitWindowMs?: number;
  };
  provider?: RawProviderConfig;
  oauth?: Array<{
    name: string;
    jwksUri: string;
    issuers: string[];
    enabled?: boolean;
  }>;
}

type RawProviderConfig =
  | RawLocalProviderConfig
  | RawRemoteProviderConfig
  | RawHybridProviderConfig
  | RawRouterProviderConfig;

interface RawLocalProviderConfig {
  type: "local";
  seed: RawSeedSource;
}

interface RawRemoteProviderConfig {
  type: "remote";
  endpoint: string;
  timeout?: number;
  apiKey?: string;
  retryCount?: number;
}

interface RawHybridProviderConfig {
  type: "hybrid";
  primary: RawLocalProviderConfig;
  fallback: RawRemoteProviderConfig;
  fallbackEnabled?: boolean;
  fallbackAfterSeconds?: number;
}

interface RawRouterProviderConfig {
  type: "router";
  defaultProvider: string;
  providers: Record<string, RawLocalProviderConfig | RawRemoteProviderConfig>;
  routes: Array<{
    name: string;
    match: { audience?: string; issuer?: string };
    provider: string;
  }>;
}

type RawSeedSource =
  | { type: "env"; envVar?: string; value?: string }
  | { type: "aws"; secretName: string; region?: string; secretKey?: string }
  | { type: "vault"; address: string; path: string; key?: string; tokenEnvVar?: string }
  | { type: "file"; path: string; key?: string }
  | string; // shorthand: just the hex value

/**
 * Find and load YAML config file.
 * Priority: CONFIG_FILE env > default paths > env-only config
 */
export function loadYamlConfig(): AppConfig {
  const configPath = findConfigFile();

  if (configPath) {
    const raw = loadRawConfig(configPath);
    return parseConfig(raw);
  }

  // Fallback to environment variables only
  return buildConfigFromEnv();
}

function findConfigFile(): string | null {
  const envPath = process.env["CONFIG_FILE"];
  if (envPath) {
    if (!existsSync(envPath)) {
      throw new Error(`Config file not found: ${envPath}`);
    }
    return envPath;
  }

  for (const path of DEFAULT_CONFIG_PATHS) {
    if (existsSync(path)) {
      return path;
    }
  }

  return null;
}

function loadRawConfig(path: string): RawConfig {
  const content = readFileSync(path, "utf-8");
  return parseYaml(content) as RawConfig;
}

function parseConfig(raw: RawConfig): AppConfig {
  return {
    server: {
      port: raw.server?.port ?? parseInt(process.env["PORT"] ?? "3000", 10),
      host: raw.server?.host ?? process.env["HOST"],
    },
    logging: {
      level: parseLogLevel(raw.logging?.level),
      format: parseLogFormat(raw.logging?.format),
    },
    security: {
      corsOrigins: raw.security?.corsOrigins ?? process.env["CORS_ORIGINS"] ?? "*",
      rateLimitMax:
        raw.security?.rateLimitMax ?? parseInt(process.env["RATE_LIMIT_MAX"] ?? "100", 10),
      rateLimitWindowMs: raw.security?.rateLimitWindowMs ?? 60000,
    },
    provider: parseProviderConfig(raw.provider),
    oauth: raw.oauth,
  };
}

function parseLogLevel(level?: string): "debug" | "info" | "warn" | "error" {
  const resolved = level ?? process.env["LOG_LEVEL"] ?? "info";
  if (["debug", "info", "warn", "error"].includes(resolved)) {
    return resolved as "debug" | "info" | "warn" | "error";
  }
  return "info";
}

function parseLogFormat(format?: string): "json" | "pretty" | undefined {
  if (format === "json" || format === "pretty") {
    return format;
  }
  return undefined;
}

function parseProviderConfig(raw?: RawProviderConfig): ProviderConfig {
  if (!raw) {
    return buildDefaultProviderFromEnv();
  }

  switch (raw.type) {
    case "local":
      return {
        type: "local",
        seed: parseSeedSource(raw.seed),
      };

    case "remote":
      return {
        type: "remote",
        endpoint: raw.endpoint,
        timeout: raw.timeout,
        apiKey: raw.apiKey,
        retryCount: raw.retryCount,
      };

    case "hybrid":
      return {
        type: "hybrid",
        primary: {
          type: "local",
          seed: parseSeedSource(raw.primary.seed),
        },
        fallback: {
          type: "remote",
          endpoint: raw.fallback.endpoint,
          timeout: raw.fallback.timeout,
          apiKey: raw.fallback.apiKey,
          retryCount: raw.fallback.retryCount,
        },
        fallbackEnabled: raw.fallbackEnabled ?? true,
        fallbackAfterSeconds: raw.fallbackAfterSeconds ?? 60,
      };

    case "router":
      return {
        type: "router",
        defaultProvider: raw.defaultProvider,
        providers: Object.fromEntries(
          Object.entries(raw.providers).map(([name, config]) => {
            if (config.type === "local") {
              return [name, { type: "local" as const, seed: parseSeedSource(config.seed) }];
            }
            return [name, config];
          })
        ),
        routes: raw.routes,
      };

    default:
      throw new Error(`Unknown provider type: ${(raw as { type: string }).type}`);
  }
}

function parseSeedSource(raw: RawSeedSource): SeedSource {
  // Shorthand: string is treated as direct value or env var reference
  if (typeof raw === "string") {
    if (raw.startsWith("$")) {
      return { type: "env", envVar: raw.slice(1) };
    }
    return { type: "env", value: raw };
  }

  switch (raw.type) {
    case "env":
      return {
        type: "env",
        envVar: raw.envVar,
        value: raw.value,
      };

    case "aws":
      return {
        type: "aws",
        secretName: raw.secretName,
        region: raw.region,
        secretKey: raw.secretKey,
      };

    case "vault":
      return {
        type: "vault",
        address: raw.address,
        path: raw.path,
        key: raw.key,
        tokenEnvVar: raw.tokenEnvVar,
      };

    case "file":
      return {
        type: "file",
        path: raw.path,
        key: raw.key,
      };

    default:
      throw new Error(`Unknown seed source type: ${(raw as { type: string }).type}`);
  }
}

function buildConfigFromEnv(): AppConfig {
  return {
    server: {
      port: parseInt(process.env["PORT"] ?? "3000", 10),
      host: process.env["HOST"],
    },
    logging: {
      level: parseLogLevel(process.env["LOG_LEVEL"]),
      format: parseLogFormat(process.env["LOG_FORMAT"]),
    },
    security: {
      corsOrigins: process.env["CORS_ORIGINS"] ?? "*",
      rateLimitMax: parseInt(process.env["RATE_LIMIT_MAX"] ?? "100", 10),
      rateLimitWindowMs: 60000,
    },
    provider: buildDefaultProviderFromEnv(),
  };
}

function buildDefaultProviderFromEnv(): ProviderConfig {
  const mode = process.env["SALT_PROVIDER_MODE"] ?? "local";

  switch (mode) {
    case "local":
      return {
        type: "local",
        seed: buildSeedSourceFromEnv(),
      };

    case "remote": {
      const endpoint = process.env["REMOTE_SALT_ENDPOINT"];
      if (!endpoint) {
        throw new Error("REMOTE_SALT_ENDPOINT is required for remote provider mode");
      }
      return {
        type: "remote",
        endpoint,
        timeout: parseInt(process.env["REMOTE_SALT_TIMEOUT"] ?? "10000", 10),
        apiKey: process.env["REMOTE_SALT_API_KEY"],
        retryCount: parseInt(process.env["REMOTE_SALT_RETRY_COUNT"] ?? "0", 10),
      };
    }

    case "hybrid":
      return {
        type: "hybrid",
        primary: {
          type: "local",
          seed: buildSeedSourceFromEnv(),
        },
        fallback: {
          type: "remote",
          endpoint:
            process.env["HYBRID_FALLBACK_ENDPOINT"] ?? "https://salt.api.mystenlabs.com/get_salt",
          timeout: 10000,
          retryCount: parseInt(process.env["HYBRID_FALLBACK_RETRY_COUNT"] ?? "0", 10),
        },
        fallbackEnabled: process.env["HYBRID_FALLBACK_ENABLED"] !== "false",
        fallbackAfterSeconds: parseInt(process.env["HYBRID_FALLBACK_AFTER_SECONDS"] ?? "60", 10),
      };

    default:
      throw new Error(`Unknown provider mode: ${mode}`);
  }
}

function buildSeedSourceFromEnv(): SeedSource {
  const seedSource = process.env["SEED_SOURCE"] ?? "env";

  switch (seedSource) {
    case "env":
      return {
        type: "env",
        envVar: "MASTER_SEED",
        value: process.env["MASTER_SEED"],
      };

    case "aws":
      return {
        type: "aws",
        secretName: process.env["AWS_SECRET_NAME"] ?? "",
        region: process.env["AWS_REGION"] ?? "us-west-2",
      };

    case "vault":
      return {
        type: "vault",
        address: process.env["VAULT_ADDR"] ?? "",
        path: process.env["VAULT_PATH"] ?? "",
        tokenEnvVar: "VAULT_TOKEN",
      };

    case "file":
      return {
        type: "file",
        path: process.env["SEED_FILE_PATH"] ?? "",
      };

    default:
      throw new Error(`Unknown seed source: ${seedSource}`);
  }
}
