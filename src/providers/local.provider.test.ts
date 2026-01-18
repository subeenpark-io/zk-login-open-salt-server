import { describe, expect, it } from "vitest";
import { LocalProvider } from "./local.provider.js";

const SEED_HEX = "0x" + "11".repeat(32);

describe("LocalProvider", () => {
  it("derives deterministic salt for same inputs", async () => {
    const provider = await LocalProvider.create({
      type: "local",
      seed: { type: "env", value: SEED_HEX },
    });
    const first = await provider.getSalt("user-1", "aud-1");
    const second = await provider.getSalt("user-1", "aud-1");

    expect(first).toBe(second);
    await provider.destroy();
  });

  it("returns 0x-prefixed salt", async () => {
    const provider = await LocalProvider.create({
      type: "local",
      seed: { type: "env", value: SEED_HEX },
    });
    const salt = await provider.getSalt("user-2", "aud-2");

    expect(salt.startsWith("0x")).toBe(true);
    await provider.destroy();
  });

  it("clears seed on destroy", async () => {
    const provider = await LocalProvider.create({
      type: "local",
      seed: { type: "env", value: SEED_HEX },
    });
    const before = await provider.healthCheck();

    const seedRef = provider["seed"] as Uint8Array;
    await provider.destroy();
    const after = await provider.healthCheck();

    expect(before.healthy).toBe(true);
    expect(after.healthy).toBe(true);
    expect(seedRef.every((value) => value === 0)).toBe(true);
  });
});
