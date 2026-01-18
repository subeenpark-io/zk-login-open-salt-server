import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { HealthResponse } from "../types/index.js";

const mockCreateProvider = vi.fn();
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
};

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

describe("Health Routes", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

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

    const { healthRoutes } = await import("./health.route.js");
    app = new Hono();
    app.route("/", healthRoutes);
  });

  describe("GET /health", () => {
    it("should return ok status", async () => {
      const res = await app.request("/health");

      expect(res.status).toBe(200);
      const body = (await res.json()) as HealthResponse;
      expect(body.status).toBe("ok");
      expect(body.timestamp).toBeTruthy();
    });
  });

  describe("GET /ready", () => {
    it("should return ok when provider is healthy", async () => {
      mockCreateProvider.mockResolvedValue({
        name: "local",
        healthCheck: vi.fn().mockResolvedValue({ healthy: true, message: "OK" }),
      });

      const res = await app.request("/ready");

      expect(res.status).toBe(200);
      const body = (await res.json()) as HealthResponse;
      expect(body.status).toBe("ok");
      expect(body.providers?.["local"]?.healthy).toBe(true);
    });

    it("should return degraded with 503 when provider is unhealthy", async () => {
      mockCreateProvider.mockResolvedValue({
        name: "local",
        healthCheck: vi.fn().mockResolvedValue({ healthy: false, message: "Unhealthy" }),
      });

      const res = await app.request("/ready");

      expect(res.status).toBe(503);
      const body = (await res.json()) as HealthResponse;
      expect(body.status).toBe("degraded");
      expect(body.providers?.["local"]?.healthy).toBe(false);
    });

    it("should return error with 503 when provider initialization fails", async () => {
      mockCreateProvider.mockRejectedValue(new Error("Failed to initialize"));

      const res = await app.request("/ready");

      expect(res.status).toBe(503);
      const body = (await res.json()) as HealthResponse;
      expect(body.status).toBe("error");
      expect(body.providers?.["unknown"]?.healthy).toBe(false);
    });
  });
});
