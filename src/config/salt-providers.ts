export type SaltProviderMode = "local" | "remote" | "hybrid" | "router";

export interface LocalProviderConfig {
  type: "local";
  seedSource: "env" | "aws" | "vault";
  // env
  masterSeed?: string | undefined;
  // aws
  awsSecretName?: string | undefined;
  awsRegion?: string | undefined;
  // vault
  vaultAddr?: string | undefined;
  vaultPath?: string | undefined;
}

export interface RemoteProviderConfig {
  type: "remote";
  endpoint: string;
  timeout?: number | undefined;
  apiKey?: string | undefined;
}

export interface HybridProviderConfig {
  type: "hybrid";
  primary: LocalProviderConfig;
  fallback: RemoteProviderConfig;
  fallbackEnabled: boolean;
  fallbackAfterSeconds: number;
}

export interface RouterProviderConfig {
  type: "router";
  defaultProvider: string;
  providers: Record<string, LocalProviderConfig | RemoteProviderConfig>;
  routes: RouterRule[];
}

export interface RouterRule {
  name: string;
  match: {
    audience?: string;
    issuer?: string;
  };
  provider: string;
}

export type SaltProviderConfig =
  | LocalProviderConfig
  | RemoteProviderConfig
  | HybridProviderConfig
  | RouterProviderConfig;

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
      throw new Error(`Unknown salt provider mode: ${mode as string}`);
  }
}

function loadLocalConfig(): LocalProviderConfig {
  const seedSource = (process.env["SEED_SOURCE"] ?? "env") as "env" | "aws" | "vault";

  return {
    type: "local",
    seedSource,
    masterSeed: process.env["MASTER_SEED"],
    awsSecretName: process.env["AWS_SECRET_NAME"],
    awsRegion: process.env["AWS_REGION"] ?? "us-west-2",
    vaultAddr: process.env["VAULT_ADDR"],
    vaultPath: process.env["VAULT_PATH"],
  };
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
