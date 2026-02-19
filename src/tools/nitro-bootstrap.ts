import { createVsockClient } from "../providers/nitro/index.js";
import { DecryptCommand, KMSClient } from "@aws-sdk/client-kms";

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

async function decryptSeedOnHost(
  encryptedSeed: string,
  kmsKeyId: string,
  awsRegion: string
): Promise<string> {
  const kmsClient = new KMSClient({ region: awsRegion });
  const response = await kmsClient.send(
    new DecryptCommand({
      KeyId: kmsKeyId,
      CiphertextBlob: Buffer.from(encryptedSeed, "base64"),
    })
  );

  if (!response.Plaintext) {
    throw new Error("KMS returned empty plaintext");
  }

  const seed = Buffer.from(response.Plaintext);
  if (seed.length !== 32) {
    throw new Error(`Invalid seed length from KMS: expected 32 bytes, got ${String(seed.length)}`);
  }

  return `0x${seed.toString("hex")}`;
}

async function main(): Promise<void> {
  const encryptedSeed = requireEnv("ENCRYPTED_SEED");
  const kmsKeyId = requireEnv("KMS_KEY_ID");
  const awsRegion = process.env["AWS_REGION"] ?? "us-west-2";
  const kmsProxyEndpoint = process.env["KMS_PROXY_ENDPOINT"];
  const forceHostDecrypt =
    (process.env["NITRO_BOOTSTRAP_HOST_DECRYPT"] ?? "false").toLowerCase() === "true";

  const enclaveCid = parseIntWithDefault(process.env["NITRO_ENCLAVE_CID"], 16);
  const port = parseIntWithDefault(process.env["NITRO_VSOCK_PORT"], 5000);
  const timeout = parseIntWithDefault(process.env["NITRO_VSOCK_TIMEOUT"], 5000);
  const retries = parseIntWithDefault(process.env["NITRO_BOOTSTRAP_RETRIES"], 6);
  const retryDelayMs = parseIntWithDefault(process.env["NITRO_BOOTSTRAP_RETRY_DELAY_MS"], 3000);

  const client = createVsockClient({ enclaveCid, port, timeout });

  console.log("[nitro-bootstrap] Starting enclave initialization");
  console.log(`[nitro-bootstrap] Target: CID=${enclaveCid}, port=${port}`);

  let lastError: Error | undefined;
  let hostDecryptedSeedHex: string | undefined;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      if (forceHostDecrypt) {
        if (!hostDecryptedSeedHex) {
          console.log("[nitro-bootstrap] Using forced host-side KMS decrypt path");
          hostDecryptedSeedHex = await decryptSeedOnHost(encryptedSeed, kmsKeyId, awsRegion);
        }

        await client.initializePlaintextSeed({ seedHex: hostDecryptedSeedHex });
      } else {
        try {
          await client.initializeSeed({
            encryptedSeed,
            kmsKeyId,
            awsRegion,
            ...(kmsProxyEndpoint !== undefined ? { kmsProxyEndpoint } : {}),
          });
        } catch (initializeError) {
          const initError =
            initializeError instanceof Error
              ? initializeError
              : new Error("Unknown initialize error");

          // Some enclave runtimes cannot source IAM credentials directly.
          // In that case, decrypt on the host and send plaintext over the secure host<->enclave channel.
          if (initError.message.includes("Could not load credentials")) {
            if (!hostDecryptedSeedHex) {
              console.log(
                "[nitro-bootstrap] Enclave credential load failed. Falling back to host-side KMS decrypt."
              );
              hostDecryptedSeedHex = await decryptSeedOnHost(
                encryptedSeed,
                kmsKeyId,
                awsRegion
              );
            }

            await client.initializePlaintextSeed({ seedHex: hostDecryptedSeedHex });
          } else {
            throw initError;
          }
        }
      }

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
