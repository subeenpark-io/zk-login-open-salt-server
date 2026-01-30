/**
 * Nitro Enclave Application for zkLogin Salt Server
 *
 * This is the main entry point for the Nitro Enclave application.
 * It initializes the vsock server, KMS client, and salt service,
 * then listens for salt derivation requests from the parent instance.
 *
 * Security Model:
 * 1. Master seed is encrypted at rest with KMS
 * 2. KMS key policy requires attestation from this specific enclave (PCR values)
 * 3. Seed is decrypted only inside the enclave memory
 * 4. Salt is derived using HKDF and returned via vsock
 * 5. Seed never leaves the enclave
 *
 * Environment Variables:
 * - ENCRYPTED_SEED: Base64-encoded encrypted master seed
 * - KMS_KEY_ID: KMS key ARN for decryption
 * - AWS_REGION: AWS region (default: us-west-2)
 * - VSOCK_PORT: vsock port to listen on (default: 5000)
 */

import { createVsockServer, JsonRpcErrorCodes } from "./vsock-server.js";
import { createSaltService } from "./salt-service.js";
import { createKmsClient, isRunningInEnclave } from "./kms-client.js";

/**
 * Configuration from environment variables
 */
interface EnclaveConfig {
  /** Base64-encoded encrypted master seed */
  encryptedSeed: string;
  /** KMS key ID/ARN for decryption */
  kmsKeyId: string;
  /** AWS region */
  awsRegion: string;
  /** vsock port */
  vsockPort: number;
  /** KMS proxy endpoint (for vsock proxy) */
  kmsProxyEndpoint?: string;
}

/**
 * Load configuration from environment
 */
function loadConfig(): EnclaveConfig {
  const encryptedSeed = process.env.ENCRYPTED_SEED;
  const kmsKeyId = process.env.KMS_KEY_ID;
  const awsRegion = process.env.AWS_REGION ?? "us-west-2";
  const vsockPort = parseInt(process.env.VSOCK_PORT ?? "5000", 10);
  const kmsProxyEndpoint = process.env.KMS_PROXY_ENDPOINT;

  if (!encryptedSeed) {
    throw new Error("ENCRYPTED_SEED environment variable is required");
  }

  if (!kmsKeyId) {
    throw new Error("KMS_KEY_ID environment variable is required");
  }

  return {
    encryptedSeed,
    kmsKeyId,
    awsRegion,
    vsockPort,
    kmsProxyEndpoint,
  };
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log("===========================================");
  console.log("zkLogin Salt Server - Nitro Enclave");
  console.log("===========================================");

  // Check if running in actual enclave
  const inEnclave = isRunningInEnclave();
  console.log(`Running in Nitro Enclave: ${inEnclave}`);

  if (!inEnclave) {
    console.warn(
      "WARNING: Not running in a Nitro Enclave. " +
        "KMS attestation will not work. This mode is for development only."
    );
  }

  // Load configuration
  let config: EnclaveConfig;
  try {
    config = loadConfig();
    console.log(`Configuration loaded:`);
    console.log(`  - AWS Region: ${config.awsRegion}`);
    console.log(`  - KMS Key ID: ${config.kmsKeyId}`);
    console.log(`  - vsock Port: ${config.vsockPort}`);
    console.log(`  - Encrypted seed length: ${config.encryptedSeed.length} chars`);
  } catch (error) {
    console.error("Failed to load configuration:", error);
    process.exit(1);
  }

  // Initialize services
  const saltService = createSaltService();
  const kmsClient = createKmsClient({
    region: config.awsRegion,
    keyId: config.kmsKeyId,
    proxyEndpoint: config.kmsProxyEndpoint,
  });

  // Decrypt master seed
  console.log("Decrypting master seed...");
  try {
    const { seed } = await kmsClient.decryptSeed(config.encryptedSeed);
    saltService.initialize(seed);
    console.log("Master seed initialized successfully");
  } catch (error) {
    console.error("Failed to decrypt master seed:", error);
    console.error(
      "Ensure KMS key policy allows decryption from this enclave (check PCR values)"
    );
    process.exit(1);
  }

  // Create vsock server
  const server = createVsockServer({ port: config.vsockPort });

  // Register deriveSalt method
  server.registerMethod("deriveSalt", (params) => {
    const { sub, aud } = params as { sub?: string; aud?: string };

    if (!sub || typeof sub !== "string") {
      throw {
        code: JsonRpcErrorCodes.INVALID_PARAMS,
        message: "Missing or invalid 'sub' parameter",
      };
    }

    if (!aud || typeof aud !== "string") {
      throw {
        code: JsonRpcErrorCodes.INVALID_PARAMS,
        message: "Missing or invalid 'aud' parameter",
      };
    }

    try {
      const salt = saltService.deriveSalt(sub, aud);
      return { salt };
    } catch (error) {
      throw {
        code: JsonRpcErrorCodes.DERIVATION_ERROR,
        message: error instanceof Error ? error.message : "Salt derivation failed",
      };
    }
  });

  // Register healthCheck method
  server.registerMethod("healthCheck", () => {
    const healthy = saltService.isHealthy();
    return {
      healthy,
      message: healthy ? "Enclave is operational" : "Enclave is not healthy",
      inEnclave,
    };
  });

  // Start server
  console.log("Starting vsock server...");
  try {
    await server.start();
    console.log("===========================================");
    console.log("Enclave ready to receive requests");
    console.log("===========================================");
  } catch (error) {
    console.error("Failed to start vsock server:", error);
    process.exit(1);
  }

  // Handle shutdown signals
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down...`);

    try {
      await server.stop();
      saltService.destroy();
      console.log("Shutdown complete");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// Run main
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
