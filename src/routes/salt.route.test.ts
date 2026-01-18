import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const mockVerifyJWT = vi.fn();
const mockCreateProvider = vi.fn();
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
};

vi.mock("../services/jwt.service.js", () => ({
  verifyJWT: mockVerifyJWT,
}));

vi.mock("../providers/index.js", () => ({
  createProvider: mockCreateProvider,
}));

vi.mock("../config/index.js", () => ({
  config: {
    saltProvider: { type: "local", seed: { type: "env", value: "test-seed" } },
  },
}));

vi.mock("../utils/logger.js", () => ({
  logger: mockLogger,
}));

describe("POST /salt", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.doMock("../services/jwt.service.js", () => ({
      verifyJWT: mockVerifyJWT,
    }));

    vi.doMock("../providers/index.js", () => ({
      createProvider: mockCreateProvider,
    }));

    vi.doMock("../config/index.js", () => ({
      config: {
        saltProvider: { type: "local", seed: { type: "env", value: "test-seed" } },
      },
    }));

    vi.doMock("../utils/logger.js", () => ({
      logger: mockLogger,
    }));

    const { saltRoutes } = await import("./salt.route.js");
    app = new Hono();
    app.route("/v1", saltRoutes);
  });

  it("should return 400 when jwt is missing", async () => {
    const res = await app.request("/v1/salt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: "missing_jwt",
      message: "JWT is required",
    });
  });

  it("should return 400 when jwt is empty string", async () => {
    const res = await app.request("/v1/salt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: "" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: "missing_jwt",
      message: "JWT is required",
    });
  });

  it("should return 401 when JWT verification fails", async () => {
    mockVerifyJWT.mockResolvedValue({
      result: { valid: false, error: "JWT signature verification failed" },
    });

    const res = await app.request("/v1/salt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: "invalid-jwt-token" }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: "invalid_jwt",
      message: "JWT signature verification failed",
    });
  });

  it("should return 401 when JWT is expired", async () => {
    mockVerifyJWT.mockResolvedValue({
      result: { valid: false, error: "JWT has expired" },
    });

    const res = await app.request("/v1/salt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: "expired-jwt-token" }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: "invalid_jwt",
      message: "JWT has expired",
    });
  });

  it("should return 400 when JWT is missing subject claim", async () => {
    mockVerifyJWT.mockResolvedValue({
      result: {
        valid: true,
        claims: {
          iss: "https://accounts.google.com",
          sub: "",
          aud: "test-client-id",
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      },
      provider: { name: "google", jwksUri: "https://www.googleapis.com/oauth2/v3/certs" },
    });

    const res = await app.request("/v1/salt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: "valid-jwt-no-sub" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: "invalid_jwt",
      message: "JWT missing subject claim",
    });
  });

  it("should return 400 when JWT is missing audience claim", async () => {
    mockVerifyJWT.mockResolvedValue({
      result: {
        valid: true,
        claims: {
          iss: "https://accounts.google.com",
          sub: "user-123",
          aud: "",
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      },
      provider: { name: "google", jwksUri: "https://www.googleapis.com/oauth2/v3/certs" },
    });

    const res = await app.request("/v1/salt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: "valid-jwt-no-aud" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: "invalid_jwt",
      message: "JWT missing audience claim",
    });
  });

  it("should return 200 with salt on success", async () => {
    const mockSalt = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

    mockVerifyJWT.mockResolvedValue({
      result: {
        valid: true,
        claims: {
          iss: "https://accounts.google.com",
          sub: "user-123",
          aud: "test-client-id",
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      },
      provider: { name: "google", jwksUri: "https://www.googleapis.com/oauth2/v3/certs" },
    });

    mockCreateProvider.mockResolvedValue({
      name: "local",
      getSalt: vi.fn().mockResolvedValue(mockSalt),
      healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
      destroy: vi.fn().mockResolvedValue(undefined),
    });

    const res = await app.request("/v1/salt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: "valid-jwt-token" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ salt: mockSalt });
  });

  it("should handle array audience in JWT", async () => {
    const mockSalt = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    mockVerifyJWT.mockResolvedValue({
      result: {
        valid: true,
        claims: {
          iss: "https://accounts.google.com",
          sub: "user-456",
          aud: ["primary-client-id", "secondary-client-id"],
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      },
      provider: { name: "google", jwksUri: "https://www.googleapis.com/oauth2/v3/certs" },
    });

    mockCreateProvider.mockResolvedValue({
      name: "local",
      getSalt: vi.fn().mockResolvedValue(mockSalt),
      healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
      destroy: vi.fn().mockResolvedValue(undefined),
    });

    const res = await app.request("/v1/salt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: "valid-jwt-with-array-aud" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ salt: mockSalt });
  });

  it("should return 500 on internal error", async () => {
    mockVerifyJWT.mockResolvedValue({
      result: {
        valid: true,
        claims: {
          iss: "https://accounts.google.com",
          sub: "user-123",
          aud: "test-client-id",
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      },
      provider: { name: "google", jwksUri: "https://www.googleapis.com/oauth2/v3/certs" },
    });

    mockCreateProvider.mockRejectedValue(new Error("Provider initialization failed"));

    const res = await app.request("/v1/salt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt: "valid-jwt-token" }),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      error: "internal_error",
      message: "An error occurred while generating salt",
    });
  });
});
