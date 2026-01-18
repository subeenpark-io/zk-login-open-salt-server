#!/usr/bin/env tsx
/**
 * Recover a master seed from shards using Shamir's Secret Sharing.
 *
 * Usage:
 *   npx tsx scripts/recover-seed.ts <shard1_index>:<shard1_hex> <shard2_index>:<shard2_hex> ...
 *
 * Example:
 *   npx tsx scripts/recover-seed.ts 1:abc123... 3:def456... 5:ghi789...
 */

import { join } from "shamir";

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: recover-seed.ts <index:shard> <index:shard> ...");
    console.error("Example: recover-seed.ts 1:abc123... 3:def456...");
    process.exit(1);
  }

  const shards: Record<number, Uint8Array> = {};

  for (const arg of args) {
    const [indexStr, shardHex] = arg.split(":");

    if (!indexStr || !shardHex) {
      console.error(`Invalid shard format: ${arg}`);
      console.error("Expected format: index:hex");
      process.exit(1);
    }

    const index = parseInt(indexStr, 10);
    shards[index] = hexToBytes(shardHex);
  }

  try {
    const recovered = join(shards);
    console.log("Recovered Master Seed:");
    console.log(bytesToHex(recovered));
    console.log("\nVerify this matches your expected seed before using it!");
  } catch (error) {
    console.error("Failed to recover seed:", error);
    process.exit(1);
  }
}

main();
