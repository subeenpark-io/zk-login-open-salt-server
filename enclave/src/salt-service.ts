/**
 * Salt Service for Nitro Enclave
 *
 * This service is responsible for deriving salt values from the master seed.
 * The seed is stored securely in enclave memory and never leaves the enclave.
 *
 * Salt derivation uses HKDF (HMAC-based Key Derivation Function) with SHA-256:
 * salt = HKDF-SHA256(seed, info="{sub}:{aud}", length=16)
 */

import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";

/**
 * SaltService handles secure salt derivation within the enclave
 */
export class SaltService {
  private seed: Uint8Array | null = null;
  private initialized = false;

  /**
   * Initialize the service with a master seed
   *
   * @param seed - 32-byte master seed
   */
  initialize(seed: Uint8Array): void {
    if (seed.length !== 32) {
      throw new Error("Master seed must be exactly 32 bytes");
    }

    this.seed = seed;
    this.initialized = true;
    console.log("[salt-service] Initialized with master seed");
  }

  /**
   * Derive salt for a given subject and audience
   *
   * @param sub - JWT subject (user identifier)
   * @param aud - JWT audience (application identifier)
   * @returns Hex-encoded salt with 0x prefix
   */
  deriveSalt(sub: string, aud: string): string {
    if (!this.initialized || !this.seed) {
      throw new Error("Salt service not initialized");
    }

    if (!sub || !aud) {
      throw new Error("Both sub and aud are required");
    }

    // Create info string for HKDF: "{sub}:{aud}"
    const info = new TextEncoder().encode(`${sub}:${aud}`);

    // Derive salt using HKDF-SHA256
    // Parameters:
    // - hash: SHA-256
    // - ikm (input key material): master seed
    // - salt: undefined (optional in HKDF)
    // - info: "{sub}:{aud}"
    // - length: 16 bytes (zkLogin-compatible)
    const salt = hkdf(sha256, this.seed, undefined, info, 16);

    // Return as hex string with 0x prefix
    return "0x" + Buffer.from(salt).toString("hex");
  }

  /**
   * Check if the service is initialized and healthy
   */
  isHealthy(): boolean {
    return this.initialized && this.seed !== null && this.seed.length === 32;
  }

  /**
   * Securely destroy the seed from memory
   */
  destroy(): void {
    if (this.seed) {
      // Overwrite seed with zeros
      this.seed.fill(0);
      this.seed = null;
    }
    this.initialized = false;
    console.log("[salt-service] Destroyed");
  }
}

/**
 * Create a new SaltService instance
 */
export function createSaltService(): SaltService {
  return new SaltService();
}
