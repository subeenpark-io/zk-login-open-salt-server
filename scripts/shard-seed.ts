#!/usr/bin/env tsx
/**
 * Split a master seed into multiple shards using Shamir's Secret Sharing.
 *
 * Usage:
 *   npx tsx scripts/shard-seed.ts <seed> <total_shards> <threshold>
 *
 * Example:
 *   npx tsx scripts/shard-seed.ts 0x1234... 5 3
 *
 * This creates 5 shards where any 3 can reconstruct the seed.
 */

import { split } from "shamir";

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length !== 3) {
    console.error("Usage: shard-seed.ts <seed> <total_shards> <threshold>");
    console.error("Example: shard-seed.ts 0x1234... 5 3");
    process.exit(1);
  }

  const [seed, totalStr, thresholdStr] = args;
  const total = parseInt(totalStr ?? "0", 10);
  const threshold = parseInt(thresholdStr ?? "0", 10);

  if (total < 2 || threshold < 2 || threshold > total) {
    console.error("Invalid shard configuration");
    console.error("Total must be >= 2, threshold must be >= 2 and <= total");
    process.exit(1);
  }

  const seedBytes = hexToBytes(seed ?? "");

  if (seedBytes.length !== 32) {
    console.error("Seed must be 32 bytes (64 hex characters)");
    process.exit(1);
  }

  const shards = split(crypto.getRandomValues, total, threshold, seedBytes);

  console.log(`Seed split into ${total.toString()} shards (threshold: ${threshold.toString()}):\n`);

  Object.entries(shards).forEach(([index, shard]) => {
    console.log(`Shard ${index}: ${bytesToHex(shard)}`);
  });

  console.log("\nDistribute these shards to different custodians.");
  console.log(`Any ${threshold.toString()} shards can reconstruct the original seed.`);
}

main();
