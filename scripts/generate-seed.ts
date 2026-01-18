#!/usr/bin/env tsx
/**
 * Generate a new master seed for the salt server.
 *
 * Usage:
 *   npx tsx scripts/generate-seed.ts
 *
 * Output:
 *   A 32-byte hex-encoded seed suitable for use as MASTER_SEED.
 */

function generateSeed(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `0x${hex}`;
}

console.log("Generated Master Seed:");
console.log(generateSeed());
console.log("\nStore this securely and never commit to version control!");
