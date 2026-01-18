/**
 * @deprecated Use yaml-loader.ts instead. This file is kept for backward compatibility.
 */

import type {
  HybridProviderConfig,
  LocalProviderConfig,
  ProviderConfig,
  RemoteProviderConfig,
  RouterProviderConfig,
} from "../types/index.js";

export type SaltProviderMode = "local" | "remote" | "hybrid" | "router";

export type SaltProviderConfig = ProviderConfig;

/**
 * @deprecated Use loadYamlConfig() from yaml-loader.ts instead
 */
export function loadSaltProviderConfig(): SaltProviderConfig {
  const mode = (process.env["SALT_PROVIDER_MODE"] ?? "local") as SaltProviderMode;

  switch (mode) {
    case "local":
      return loadLocalConfig();
    case "remote":
      return loadRemoteConfig();
    case "hybrid":
      return loadHybridConfig();
    case "router":
      return loadRouterConfig();
    default:
      throw new Error(`Unknown salt provider mode: ${mode}`);
  }
}

function loadLocalConfig(): LocalProviderConfig {
  const seedSource = (process.env["SEED_SOURCE"] ?? "env") as "env" | "aws" | "vault" | "file";

  switch (seedSource) {
    case "aws":
      return {
        type: "local",
        seed: {
          type: "aws",
          secretName: process.env["AWS_SECRET_NAME"] ?? "",
          region: process.env["AWS_REGION"] ?? "us-west-2",
        },
      };

    case "vault":
      return {
        type: "local",
        seed: {
          type: "vault",
          address: process.env["VAULT_ADDR"] ?? "",
          path: process.env["VAULT_PATH"] ?? "",
          tokenEnvVar: "VAULT_TOKEN",
        },
      };

    case "file":
      return {
        type: "local",
        seed: {
          type: "file",
          path: process.env["SEED_FILE_PATH"] ?? "",
        },
      };

    case "env":
    default:
      return {
        type: "local",
        seed: {
          type: "env",
          envVar: "MASTER_SEED",
          value: process.env["MASTER_SEED"],
        },
      };
  }
}

function loadRemoteConfig(): RemoteProviderConfig {
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

function loadHybridConfig(): HybridProviderConfig {
  return {
    type: "hybrid",
    primary: loadLocalConfig(),
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
}

function loadRouterConfig(): RouterProviderConfig {
  const configJson = process.env["ROUTER_CONFIG_JSON"];
  const configPath = process.env["ROUTER_CONFIG_PATH"];

  if (configJson) {
    return JSON.parse(configJson) as RouterProviderConfig;
  }

  if (configPath) {
    // TODO: Load from file
    throw new Error("ROUTER_CONFIG_PATH not yet implemented");
  }

  throw new Error("ROUTER_CONFIG_JSON or ROUTER_CONFIG_PATH is required for router mode");
}

// Re-export types for backward compatibility
export type {
  LocalProviderConfig,
  RemoteProviderConfig,
  HybridProviderConfig,
  RouterProviderConfig,
} from "../types/index.js";
