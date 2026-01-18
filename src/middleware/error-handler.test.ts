import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError, z } from "zod";

vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

class JWTError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "JWTError";
  }
}

vi.mock("../services/jwt.service.js", () => ({
  JWTError,
}));

describe("errorHandler", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock("../utils/logger.js", () => ({
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
      },
    }));

    vi.doMock("../services/jwt.service.js", () => ({
      JWTError,
    }));

    const { errorHandler } = await import("./error-handler.js");

    app = new Hono();
    app.onError(errorHandler);
  });

  it("should handle JWTError with 401 status", async () => {
    app.get("/jwt-error", () => {
      throw new JWTError("invalid_signature", "JWT signature verification failed");
    });

    const res = await app.request("/jwt-error");

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: "invalid_signature",
      message: "JWT signature verification failed",
    });
  });

  it("should handle ZodError with 400 status", async () => {
    app.get("/zod-error", (): never => {
      const schema = z.object({ name: z.string() });
      schema.parse({ name: 123 });
      throw new Error("unreachable");
    });

    const res = await app.request("/zod-error");

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: "validation_error",
      message: "Invalid request data",
    });
  });

  it("should handle HTTPException with its status", async () => {
    app.get("/http-error", () => {
      throw new HTTPException(403, { message: "Forbidden" });
    });

    const res = await app.request("/http-error");

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({
      error: "http_403",
      message: "Forbidden",
    });
  });

  it("should handle JSON SyntaxError with 400 status", async () => {
    app.get("/json-error", () => {
      const err = new SyntaxError("Unexpected token in JSON");
      throw err;
    });

    const res = await app.request("/json-error");

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: "invalid_json",
      message: "Invalid JSON in request body",
    });
  });

  it("should handle unknown errors with 500 status", async () => {
    app.get("/unknown-error", () => {
      throw new Error("Something went wrong");
    });

    const res = await app.request("/unknown-error");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      error: "internal_error",
      message: "An unexpected error occurred",
    });
  });
});
