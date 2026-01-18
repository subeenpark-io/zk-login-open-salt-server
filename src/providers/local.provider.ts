import type { SaltProvider } from "./index.js";
import type { LocalProviderConfig } from "../config/salt-providers.js";
import { deriveSalt } from "../services/seed.service.js";
import { bytesToHex } from "../utils/crypto.js";

export class LocalProvider implements SaltProvider {
  readonly name = "local";
  private seed: Uint8Array;

  private constructor(seed: Uint8Array) {
    this.seed = seed;
  }

  static async create(config: LocalProviderConfig): Promise<LocalProvider> {
    const seed = await loadSeed(config);
    return new LocalProvider(seed);
  }

  async getSalt(sub: string, aud: string): Promise<string> {
    const salt = deriveSalt(this.seed, sub, aud);
    return bytesToHex(salt);
  }

  async healthCheck(): Promise<boolean> {
    return this.seed.length === 32;
  }

  async destroy(): Promise<void> {
    // Clear seed from memory
    this.seed.fill(0);
  }
}

async function loadSeed(config: LocalProviderConfig): Promise<Uint8Array> {
  switch (config.seedSource) {
    case "env":
      return loadSeedFromEnv(config.masterSeed);
    case "aws":
      return loadSeedFromAWS(config.awsSecretName, config.awsRegion);
    case "vault":
      return loadSeedFromVault(config.vaultAddr, config.vaultPath);
    default:
      throw new Error(`Unknown seed source: ${config.seedSource as string}`);
  }
}

function loadSeedFromEnv(masterSeed: string | undefined): Uint8Array {
  if (!masterSeed) {
    throw new Error("MASTER_SEED environment variable is required");
  }

  const hex = masterSeed.startsWith("0x") ? masterSeed.slice(2) : masterSeed;
  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  if (bytes.length !== 32) {
    throw new Error("MASTER_SEED must be 32 bytes (64 hex characters)");
  }

  return bytes;
}

async function loadSeedFromAWS(
  _secretName: string | undefined,
  _region: string | undefined
): Promise<Uint8Array> {
  // TODO: Implement AWS Secrets Manager integration
  throw new Error("AWS Secrets Manager integration not yet implemented");
}

async function loadSeedFromVault(
  _vaultAddr: string | undefined,
  _vaultPath: string | undefined
): Promise<Uint8Array> {
  // TODO: Implement HashiCorp Vault integration
  throw new Error("HashiCorp Vault integration not yet implemented");
}
