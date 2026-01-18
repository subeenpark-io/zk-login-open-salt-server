import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const mockConfig = {
  rateLimitMax: 3,
  rateLimitWindowMs: 60000,
  saltProvider: { type: "local", seed: { type: "env", value: "test" } },
};

vi.mock("../config/index.js", () => ({
  config: mockConfig,
}));

describe("rateLimitMiddleware", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock("../config/index.js", () => ({
      config: mockConfig,
    }));

    const { rateLimitMiddleware, clearRateLimitStore, stopCleanup } =
      await import("./rate-limit.js");

    stopCleanup();
    clearRateLimitStore();

    app = new Hono();
    app.use("*", rateLimitMiddleware);
    app.get("/test", (c) => c.text("ok"));
  });

  it("should allow requests under the limit", async () => {
    const res = await app.request("/test", {
      headers: { "x-forwarded-for": "192.168.1.1" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("3");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("2");
    expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
  });

  it("should decrement remaining count on each request", async () => {
    const ip = "192.168.1.2";

    const res1 = await app.request("/test", {
      headers: { "x-forwarded-for": ip },
    });
    expect(res1.headers.get("X-RateLimit-Remaining")).toBe("2");

    const res2 = await app.request("/test", {
      headers: { "x-forwarded-for": ip },
    });
    expect(res2.headers.get("X-RateLimit-Remaining")).toBe("1");

    const res3 = await app.request("/test", {
      headers: { "x-forwarded-for": ip },
    });
    expect(res3.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("should return 429 when rate limit exceeded", async () => {
    const ip = "192.168.1.3";

    for (let i = 0; i < 3; i++) {
      await app.request("/test", {
        headers: { "x-forwarded-for": ip },
      });
    }

    const res = await app.request("/test", {
      headers: { "x-forwarded-for": ip },
    });

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();

    const body = await res.json();
    expect(body).toEqual({
      error: "rate_limit_exceeded",
      message: "Too many requests, please try again later",
    });
  });

  it("should track different IPs separately", async () => {
    const ip1 = "10.0.0.1";
    const ip2 = "10.0.0.2";

    for (let i = 0; i < 3; i++) {
      await app.request("/test", {
        headers: { "x-forwarded-for": ip1 },
      });
    }

    const res1 = await app.request("/test", {
      headers: { "x-forwarded-for": ip1 },
    });
    expect(res1.status).toBe(429);

    const res2 = await app.request("/test", {
      headers: { "x-forwarded-for": ip2 },
    });
    expect(res2.status).toBe(200);
  });

  it("should use x-real-ip header if x-forwarded-for is not present", async () => {
    const res = await app.request("/test", {
      headers: { "x-real-ip": "172.16.0.1" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("2");
  });

  it("should use cf-connecting-ip header for Cloudflare", async () => {
    const res = await app.request("/test", {
      headers: { "cf-connecting-ip": "203.0.113.1" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("2");
  });
});
