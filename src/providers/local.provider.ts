import { readFileSync } from "node:fs";
import type {
  HealthCheckResult,
  LocalProviderConfig,
  SaltProvider,
  SeedSource,
  SeedSourceAws,
  SeedSourceFile,
  SeedSourceVault,
} from "../types/index.js";
import { deriveSalt } from "../services/seed.service.js";
import { bytesToHex, hexToBytes } from "../utils/crypto.js";

export class LocalProvider implements SaltProvider {
  readonly name = "local";
  readonly type = "local";
  private seed: Uint8Array;

  private constructor(seed: Uint8Array) {
    this.seed = seed;
  }

  static async create(config: LocalProviderConfig): Promise<LocalProvider> {
    const seed = await loadSeed(config.seed);
    return new LocalProvider(seed);
  }

  async getSalt(sub: string, aud: string, _jwt?: string): Promise<string> {
    const salt = deriveSalt(this.seed, sub, aud);
    return bytesToHex(salt);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    if (this.seed.length !== 32) {
      return { healthy: false, message: "Seed must be 32 bytes" };
    }

    return { healthy: true };
  }

  async destroy(): Promise<void> {
    // Clear seed from memory
    this.seed.fill(0);
  }
}

async function loadSeed(source: SeedSource): Promise<Uint8Array> {
  switch (source.type) {
    case "env":
      return loadSeedFromEnv(source.envVar, source.value);
    case "aws":
      return loadSeedFromAWS(source);
    case "vault":
      return loadSeedFromVault(source);
    case "file":
      return loadSeedFromFile(source);
    default:
      throw new Error(`Unknown seed source type: ${(source as { type: string }).type}`);
  }
}

function loadSeedFromEnv(envVar?: string, directValue?: string): Uint8Array {
  const value = directValue ?? process.env[envVar ?? "MASTER_SEED"];

  if (!value) {
    const varName = envVar ?? "MASTER_SEED";
    throw new Error(`${varName} environment variable is required`);
  }

  const bytes = hexToBytes(value);
  return ensureSeedLength(bytes);
}

async function loadSeedFromAWS(source: SeedSourceAws): Promise<Uint8Array> {
  if (!source.secretName) {
    throw new Error("AWS secretName is required for AWS seed source");
  }

  const { SecretsManagerClient, GetSecretValueCommand } =
    await import("@aws-sdk/client-secrets-manager");

  const client = new SecretsManagerClient({ region: source.region ?? "us-west-2" });
  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: source.secretName,
    })
  );

  if (response.SecretString) {
    return parseSeedFromString(response.SecretString, source.secretKey);
  }

  if (response.SecretBinary) {
    const buffer = Buffer.from(response.SecretBinary);
    if (buffer.length === 32) {
      return new Uint8Array(buffer);
    }

    return parseSeedFromString(buffer.toString("utf-8"), source.secretKey);
  }

  throw new Error("AWS secret is empty");
}

async function loadSeedFromVault(source: SeedSourceVault): Promise<Uint8Array> {
  if (!source.address) {
    throw new Error("Vault address is required for Vault seed source");
  }

  if (!source.path) {
    throw new Error("Vault path is required for Vault seed source");
  }

  const tokenEnvVar = source.tokenEnvVar ?? "VAULT_TOKEN";
  const token = process.env[tokenEnvVar];
  if (!token) {
    throw new Error(`${tokenEnvVar} is required for Vault seed source`);
  }

  const baseUrl = source.address.replace(/\/$/, "");
  const path = source.path.replace(/^\/+/, "");
  const response = await fetch(`${baseUrl}/v1/${path}`, {
    headers: {
      "X-Vault-Token": token,
    },
  });

  if (!response.ok) {
    throw new Error(`Vault request failed with ${response.status.toString()}`);
  }

  const data = (await response.json()) as {
    data?: { data?: Record<string, unknown> } | Record<string, unknown>;
  };
  const payload =
    (data.data as { data?: Record<string, unknown> } | undefined)?.data ??
    (data.data as Record<string, unknown> | undefined);

  if (!payload) {
    throw new Error("Vault response missing data payload");
  }

  const keyName = source.key ?? "masterSeed";
  const masterSeed = payload[keyName] ?? payload["seed"];
  if (typeof masterSeed !== "string") {
    throw new Error(`Vault secret must contain ${keyName} or seed`);
  }

  return parseSeedFromString(masterSeed);
}

function loadSeedFromFile(source: SeedSourceFile): Uint8Array {
  if (!source.path) {
    throw new Error("File path is required for file seed source");
  }

  const content = readFileSync(source.path, "utf-8").trim();
  return parseSeedFromString(content, source.key);
}

function parseSeedFromString(value: string, keyName?: string): Uint8Array {
  const trimmed = value.trim();

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const candidate = (keyName ? parsed[keyName] : parsed["masterSeed"]) ?? parsed["seed"];

      if (typeof candidate === "string") {
        return ensureSeedLength(hexToBytes(candidate));
      }
    } catch {
      // Fall through to hex parsing below
    }
  }

  return ensureSeedLength(hexToBytes(trimmed));
}

function ensureSeedLength(bytes: Uint8Array): Uint8Array {
  if (bytes.length !== 32) {
    throw new Error("MASTER_SEED must be 32 bytes (64 hex characters)");
  }

  return bytes;
}
