import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const mockCreateVsockClient = vi.fn();
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
};

async function createAppWithProviderConfig(saltProviderConfig: unknown): Promise<Hono> {
  vi.resetModules();
  vi.clearAllMocks();

  vi.doMock("../config/index.js", () => ({
    config: {
      saltProvider: saltProviderConfig,
    },
  }));

  vi.doMock("../providers/nitro/index.js", () => ({
    createVsockClient: mockCreateVsockClient,
  }));

  vi.doMock("../utils/logger.js", () => ({
    logger: mockLogger,
  }));

  const { attestationRoutes } = await import("./attestation.route.js");
  const app = new Hono();
  app.route("/v1", attestationRoutes);
  return app;
}

describe("GET /attestation", () => {
  it("returns unavailable when provider is not using nitro", async () => {
    const app = await createAppWithProviderConfig({
      type: "local",
      seed: { type: "env", value: "0x" + "11".repeat(32) },
    });

    const res = await app.request("/v1/attestation");
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; message: string };
    expect(body.status).toBe("unavailable");
    expect(body.message).toContain("not using Nitro Enclaves");
  });

  it("returns attestation info when nitro probe succeeds", async () => {
    mockCreateVsockClient.mockReturnValue({
      getAttestationInfo: vi.fn().mockResolvedValue({
        mode: "nitro-enclave",
        inEnclave: true,
        initialized: true,
        kmsAttestationVerified: true,
        awsRegion: "us-west-2",
        kmsKeyConfigured: true,
        kmsProxyConfigured: false,
        timestamp: new Date().toISOString(),
      }),
    });

    const app = await createAppWithProviderConfig({
      type: "local",
      seed: { type: "nitro", enclaveCid: 16, port: 5000, timeout: 5000 },
    });

    const res = await app.request("/v1/attestation");
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      status: string;
      results: Array<Record<string, unknown>>;
    };
    expect(body.status).toBe("ok");
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      target: "local",
      reachable: true,
      mode: "nitro-enclave",
      initialized: true,
    });
  });

  it("returns 503 when nitro probe fails", async () => {
    mockCreateVsockClient.mockReturnValue({
      getAttestationInfo: vi.fn().mockRejectedValue(new Error("vsock unavailable")),
    });

    const app = await createAppWithProviderConfig({
      type: "local",
      seed: { type: "nitro", enclaveCid: 16, port: 5000, timeout: 5000 },
    });

    const res = await app.request("/v1/attestation");
    expect(res.status).toBe(503);

    const body = (await res.json()) as {
      status: string;
      results: Array<Record<string, unknown>>;
    };
    expect(body.status).toBe("error");
    expect(body.results[0]).toMatchObject({
      target: "local",
      reachable: false,
      error: "vsock unavailable",
    });
  });
});
