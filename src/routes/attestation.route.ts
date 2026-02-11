import { Hono } from "hono";
import { config } from "../config/index.js";
import type {
  HybridProviderConfig,
  LocalProviderConfig,
  ProviderConfig,
  RouterProviderConfig,
  SeedSourceNitro,
} from "../types/index.js";
import { createVsockClient, type AttestationInfoResult } from "../providers/nitro/index.js";
import { logger } from "../utils/logger.js";

interface NitroTarget {
  target: string;
  seed: SeedSourceNitro;
}

interface AttestationProbeSuccess extends AttestationInfoResult {
  target: string;
  reachable: true;
}

interface AttestationProbeFailure {
  target: string;
  reachable: false;
  error: string;
}

type AttestationProbeResult = AttestationProbeSuccess | AttestationProbeFailure;

interface AttestationResponse {
  status: "ok" | "unavailable" | "error";
  timestamp: string;
  providerType: ProviderConfig["type"];
  message?: string;
  results?: AttestationProbeResult[];
}

export const attestationRoutes = new Hono();

attestationRoutes.get("/attestation", async (c) => {
  const targets = resolveNitroTargets(config.saltProvider);

  if (targets.length === 0) {
    return c.json<AttestationResponse>({
      status: "unavailable",
      timestamp: new Date().toISOString(),
      providerType: config.saltProvider.type,
      message: "Current provider configuration is not using Nitro Enclaves",
    });
  }

  const results = await Promise.all(targets.map((target) => probeAttestationTarget(target)));
  const hasFailure = results.some((result) => !result.reachable);

  logger.info("Attestation endpoint checked", {
    targetCount: results.length,
    hasFailure,
  });

  return c.json<AttestationResponse>(
    {
      status: hasFailure ? "error" : "ok",
      timestamp: new Date().toISOString(),
      providerType: config.saltProvider.type,
      results,
    },
    hasFailure ? 503 : 200
  );
});

async function probeAttestationTarget(target: NitroTarget): Promise<AttestationProbeResult> {
  try {
    const client = createVsockClient({
      ...(target.seed.enclaveCid !== undefined ? { enclaveCid: target.seed.enclaveCid } : {}),
      ...(target.seed.port !== undefined ? { port: target.seed.port } : {}),
      ...(target.seed.timeout !== undefined ? { timeout: target.seed.timeout } : {}),
    });

    const info = await client.getAttestationInfo();
    return {
      target: target.target,
      reachable: true,
      ...info,
    };
  } catch (error) {
    return {
      target: target.target,
      reachable: false,
      error: error instanceof Error ? error.message : "Unknown attestation probe error",
    };
  }
}

function resolveNitroTargets(provider: ProviderConfig): NitroTarget[] {
  switch (provider.type) {
    case "local":
      return resolveFromLocalProvider("local", provider);
    case "hybrid":
      return resolveFromHybridProvider(provider);
    case "router":
      return resolveFromRouterProvider(provider);
    case "remote":
      return [];
    default:
      return [];
  }
}

function resolveFromLocalProvider(target: string, provider: LocalProviderConfig): NitroTarget[] {
  if (provider.seed.type !== "nitro") {
    return [];
  }

  return [{ target, seed: provider.seed }];
}

function resolveFromHybridProvider(provider: HybridProviderConfig): NitroTarget[] {
  return resolveFromLocalProvider("hybrid.primary", provider.primary);
}

function resolveFromRouterProvider(provider: RouterProviderConfig): NitroTarget[] {
  const targets: NitroTarget[] = [];

  for (const [name, providerConfig] of Object.entries(provider.providers)) {
    if (providerConfig.type !== "local") {
      continue;
    }

    targets.push(...resolveFromLocalProvider(`router.${name}`, providerConfig));
  }

  return targets;
}
