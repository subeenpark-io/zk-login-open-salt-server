import { afterEach, describe, expect, it } from "vitest";
import type { Context } from "hono";
import { createSaltPlugins, runSaltPlugins } from "./salt-plugins.js";
import type { VerifiedJWT } from "../services/jwt.service.js";

const verified: VerifiedJWT = {
  payload: {
    iss: "https://accounts.google.com",
    sub: "user-1",
    aud: "client-1",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  },
  provider: {
    name: "google",
    jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
    issuers: ["https://accounts.google.com"],
  },
};

const originalSaltApiKey = process.env["SALT_API_KEY"];

function mockContext(headers: Record<string, string> = {}): Context {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  return {
    req: {
      header: (name: string) => normalizedHeaders[name.toLowerCase()],
    },
  } as unknown as Context;
}

afterEach(() => {
  if (originalSaltApiKey === undefined) {
    delete process.env["SALT_API_KEY"];
  } else {
    process.env["SALT_API_KEY"] = originalSaltApiKey;
  }
});

describe("salt plugins", () => {
  it("returns empty plugins when no config is provided", () => {
    expect(createSaltPlugins(undefined)).toEqual([]);
  });

  it("enforces api key auth when enabled", async () => {
    process.env["SALT_API_KEY"] = "secret-key";

    const plugins = createSaltPlugins({
      apiKeyAuth: {
        enabled: true,
      },
    });

    await expect(
      runSaltPlugins(plugins, {
        c: mockContext(),
        jwt: "jwt",
        verified,
        audience: "client-1",
      })
    ).rejects.toMatchObject({
      code: "unauthorized",
      status: 401,
    });

    await expect(
      runSaltPlugins(plugins, {
        c: mockContext({ "x-api-key": "secret-key" }),
        jwt: "jwt",
        verified,
        audience: "client-1",
      })
    ).resolves.toBeUndefined();
  });

  it("applies audience allowlist with wildcard matching", async () => {
    const plugins = createSaltPlugins({
      audAllowlist: {
        enabled: true,
        audiences: ["allowed-*"],
      },
    });

    await expect(
      runSaltPlugins(plugins, {
        c: mockContext(),
        jwt: "jwt",
        verified,
        audience: "blocked-client",
      })
    ).rejects.toMatchObject({
      code: "audience_not_allowed",
      status: 403,
    });

    await expect(
      runSaltPlugins(plugins, {
        c: mockContext(),
        jwt: "jwt",
        verified,
        audience: "allowed-client",
      })
    ).resolves.toBeUndefined();
  });
});
