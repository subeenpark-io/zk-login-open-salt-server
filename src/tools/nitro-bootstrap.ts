import { createVsockClient } from "../providers/nitro/index.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

function parseIntWithDefault(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer value: ${value}`);
  }

  return parsed;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const encryptedSeed = requireEnv("ENCRYPTED_SEED");
  const kmsKeyId = requireEnv("KMS_KEY_ID");
  const awsRegion = process.env["AWS_REGION"] ?? "us-west-2";
  const kmsProxyEndpoint = process.env["KMS_PROXY_ENDPOINT"];

  const enclaveCid = parseIntWithDefault(process.env["NITRO_ENCLAVE_CID"], 16);
  const port = parseIntWithDefault(process.env["NITRO_VSOCK_PORT"], 5000);
  const timeout = parseIntWithDefault(process.env["NITRO_VSOCK_TIMEOUT"], 5000);
  const retries = parseIntWithDefault(process.env["NITRO_BOOTSTRAP_RETRIES"], 6);
  const retryDelayMs = parseIntWithDefault(process.env["NITRO_BOOTSTRAP_RETRY_DELAY_MS"], 3000);

  const client = createVsockClient({ enclaveCid, port, timeout });

  console.log("[nitro-bootstrap] Starting enclave initialization");
  console.log(`[nitro-bootstrap] Target: CID=${enclaveCid}, port=${port}`);

  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await client.initializeSeed({
        encryptedSeed,
        kmsKeyId,
        awsRegion,
        ...(kmsProxyEndpoint !== undefined ? { kmsProxyEndpoint } : {}),
      });

      const health = await client.healthCheck();
      if (!health.healthy) {
        throw new Error(health.message ?? "Enclave health check failed after initialization");
      }

      console.log("[nitro-bootstrap] Enclave initialized successfully");
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown bootstrap error");

      if (attempt >= retries) {
        break;
      }

      console.log(
        `[nitro-bootstrap] Attempt ${attempt}/${retries} failed: ${lastError.message}. Retrying in ${retryDelayMs}ms`
      );
      await sleep(retryDelayMs);
    }
  }

  throw lastError ?? new Error("Nitro enclave bootstrap failed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`[nitro-bootstrap] Failed: ${message}`);
  process.exit(1);
});
