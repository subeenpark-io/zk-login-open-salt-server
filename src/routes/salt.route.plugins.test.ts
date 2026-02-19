import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

class JWTError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "JWTError";
  }
}

const mockVerifyJWT = vi.fn();
const mockCreateProvider = vi.fn();

const verifiedJwt = {
  payload: {
    iss: "https://accounts.google.com",
    sub: "user-123",
    aud: "client-123",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  },
  provider: {
    name: "google",
    jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
    issuers: ["https://accounts.google.com"],
  },
};

const mockProvider = {
  name: "local",
  type: "local",
  getSalt: vi.fn().mockResolvedValue("0x" + "11".repeat(32)),
  healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
  destroy: vi.fn().mockResolvedValue(undefined),
};

async function createAppWithPlugins(plugins: unknown): Promise<Hono> {
  vi.resetModules();
  vi.clearAllMocks();

  vi.doMock("../services/jwt.service.js", () => ({
    verifyJWT: mockVerifyJWT,
    JWTError,
  }));

  vi.doMock("../providers/index.js", () => ({
    createProvider: mockCreateProvider,
  }));

  vi.doMock("../config/index.js", () => ({
    config: {
      saltProvider: { type: "local", seed: { type: "env", value: "test-seed" } },
      plugins,
    },
  }));

  vi.doMock("../utils/logger.js", () => ({
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    },
  }));

  const { saltRoutes } = await import("./salt.route.js");
  const app = new Hono();
  app.route("/v1", saltRoutes);
  return app;
}

beforeEach(() => {
  mockVerifyJWT.mockResolvedValue(verifiedJwt);
  mockCreateProvider.mockResolvedValue(mockProvider);
});

afterEach(() => {
  delete process.env["SALT_API_KEY"];
});

describe("POST /salt plugin integration", () => {
  it("returns 401 when apiKeyAuth plugin is enabled and api key is missing", async () => {
    process.env["SALT_API_KEY"] = "super-secret";
    const app = await createAppWithPlugins({
      apiKeyAuth: { enabled: true },
    });

    const res = await app.request("/v1/salt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: "valid-jwt-token" }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: "unauthorized",
      message: "API key is missing or invalid",
    });
  });

  it("returns 403 when audAllowlist plugin blocks the audience", async () => {
    const app = await createAppWithPlugins({
      audAllowlist: {
        enabled: true,
        audiences: ["allowed-*"],
      },
    });

    const res = await app.request("/v1/salt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: "valid-jwt-token" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({
      error: "audience_not_allowed",
      message: "JWT audience is not allowed",
    });
  });
});
