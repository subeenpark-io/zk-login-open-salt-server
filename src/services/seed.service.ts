import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";

/**
 * Derives a deterministic salt from a master seed and user/app identifiers.
 *
 * Uses HKDF (HMAC-based Key Derivation Function) with SHA-256 to derive
 * a 16-byte (128-bit) salt that is unique to the combination of:
 * - Master seed (server secret)
 * - Subject (user ID from JWT)
 * - Audience (app ID from JWT)
 *
 * Note: zkLogin requires exactly 16 bytes (128 bits) for the salt.
 *
 * @param masterSeed - 32-byte master seed
 * @param sub - JWT subject claim (user identifier)
 * @param aud - JWT audience claim (app identifier)
 * @returns 16-byte derived salt (for zkLogin compatibility)
 */
export function deriveSalt(masterSeed: Uint8Array, sub: string, aud: string): Uint8Array {
  const info = new TextEncoder().encode(`${sub}:${aud}`);
  return hkdf(sha256, masterSeed, /* salt= */ undefined, info, 16);
}
