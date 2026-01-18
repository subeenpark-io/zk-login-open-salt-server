import { Hono } from "hono";
import { createProvider } from "../providers/index.js";
import type { SaltProvider } from "../types/index.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import type { HealthResponse, HealthCheckResult } from "../types/index.js";

export const healthRoutes = new Hono();

let provider: SaltProvider | null = null;

async function getProvider(): Promise<SaltProvider> {
  if (!provider) {
    provider = await createProvider(config.saltProvider);
  }
  return provider;
}

healthRoutes.get("/health", (c) => {
  return c.json<HealthResponse>({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get("/ready", async (c) => {
  try {
    const saltProvider = await getProvider();
    const healthResult = await saltProvider.healthCheck();
    const isHealthy = healthResult.healthy;

    const providerResult: HealthCheckResult = {
      healthy: isHealthy,
      message:
        healthResult.message ??
        (isHealthy ? "Provider is healthy" : "Provider health check failed"),
    };

    const status = isHealthy ? "ok" : "degraded";

    logger.debug("Readiness check completed", {
      status,
      providerHealthy: isHealthy,
    });

    return c.json<HealthResponse>(
      {
        status,
        timestamp: new Date().toISOString(),
        providers: {
          [saltProvider.name]: providerResult,
        },
      },
      isHealthy ? 200 : 503
    );
  } catch (error) {
    logger.error("Readiness check failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return c.json<HealthResponse>(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        providers: {
          unknown: {
            healthy: false,
            message: "Failed to initialize provider",
          },
        },
      },
      503
    );
  }
});
