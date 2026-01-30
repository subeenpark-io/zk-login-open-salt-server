/**
 * KMS Client for Nitro Enclave
 *
 * This module handles secure communication with AWS KMS from within
 * a Nitro Enclave, using attestation documents for cryptographic
 * proof of enclave identity.
 *
 * When a Nitro Enclave requests KMS decryption, it includes an
 * attestation document that KMS validates against the KMS key policy.
 * Only requests from enclaves with matching PCR values are allowed.
 *
 * @see https://docs.aws.amazon.com/kms/latest/developerguide/services-nitro-enclaves.html
 */

import { KMSClient, DecryptCommand } from "@aws-sdk/client-kms";

/**
 * Configuration for KMS operations within Nitro Enclave
 */
export interface KmsConfig {
  /** AWS region for KMS */
  region: string;
  /** KMS key ID or ARN for decryption */
  keyId: string;
  /** Proxy endpoint for KMS (Nitro Enclaves use vsock proxy) */
  proxyEndpoint?: string;
}

/**
 * Result of seed decryption
 */
export interface DecryptedSeed {
  /** Decrypted seed as Uint8Array */
  seed: Uint8Array;
}

/**
 * Error thrown when KMS attestation fails
 */
export class AttestationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttestationError";
  }
}

/**
 * Error thrown when decryption fails
 */
export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecryptionError";
  }
}

/**
 * EnclaveKmsClient handles KMS operations within Nitro Enclave
 *
 * This client is designed to work with the vsock proxy (kmstool-enclave-cli)
 * that routes KMS requests through the parent instance while including
 * attestation documents.
 *
 * @example
 * ```typescript
 * const kmsClient = new EnclaveKmsClient({
 *   region: "us-west-2",
 *   keyId: "arn:aws:kms:us-west-2:123456789012:key/abc123",
 * });
 *
 * const { seed } = await kmsClient.decryptSeed(encryptedSeed);
 * ```
 */
export class EnclaveKmsClient {
  private readonly client: KMSClient;
  private readonly keyId: string;

  constructor(config: KmsConfig) {
    this.keyId = config.keyId;

    // Configure KMS client
    // In Nitro Enclaves, use the vsock proxy endpoint
    const clientConfig: { region: string; endpoint?: string } = {
      region: config.region,
    };

    if (config.proxyEndpoint) {
      clientConfig.endpoint = config.proxyEndpoint;
    }

    this.client = new KMSClient(clientConfig);
    console.log(`[kms-client] Initialized for region ${config.region}`);
  }

  /**
   * Decrypt the encrypted seed using KMS with attestation
   *
   * In a Nitro Enclave, this request goes through the vsock proxy
   * (kmstool-enclave-cli) which attaches the attestation document.
   *
   * @param encryptedSeed - Base64 or binary encrypted seed
   * @returns Decrypted seed
   */
  async decryptSeed(encryptedSeed: Uint8Array | string): Promise<DecryptedSeed> {
    console.log("[kms-client] Decrypting seed with attestation...");

    // Convert string to Uint8Array if needed
    const ciphertext =
      typeof encryptedSeed === "string"
        ? Buffer.from(encryptedSeed, "base64")
        : encryptedSeed;

    try {
      // In a real Nitro Enclave environment, the attestation document
      // is automatically attached by the vsock proxy
      const command = new DecryptCommand({
        KeyId: this.keyId,
        CiphertextBlob: ciphertext,
        // The attestation document is handled by the vsock proxy
        // and is not explicitly passed here
      });

      const response = await this.client.send(command);

      if (!response.Plaintext) {
        throw new DecryptionError("KMS returned empty plaintext");
      }

      const seed = new Uint8Array(response.Plaintext);

      if (seed.length !== 32) {
        throw new DecryptionError(
          `Invalid seed length: expected 32 bytes, got ${seed.length}`
        );
      }

      console.log("[kms-client] Seed decrypted successfully");
      return { seed };
    } catch (error) {
      // Check for attestation-related errors
      if (error instanceof Error) {
        if (
          error.message.includes("AccessDenied") ||
          error.message.includes("attestation")
        ) {
          throw new AttestationError(
            `Attestation validation failed: ${error.message}`
          );
        }
      }

      throw new DecryptionError(
        `Failed to decrypt seed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Create a new EnclaveKmsClient instance
 */
export function createKmsClient(config: KmsConfig): EnclaveKmsClient {
  return new EnclaveKmsClient(config);
}

/**
 * Get attestation document from Nitro Security Module
 *
 * This function retrieves the attestation document from the Nitro
 * Security Module (NSM). The attestation document contains:
 * - PCR values (measurements of enclave image)
 * - Module ID
 * - Timestamp
 * - Public key (optional, for key exchange)
 *
 * Note: This is a placeholder. In a real enclave, you would use
 * the NSM device (/dev/nsm) to generate attestation documents.
 */
export async function getAttestationDocument(): Promise<Uint8Array> {
  // In a real Nitro Enclave, this would:
  // 1. Open /dev/nsm
  // 2. Call NSM_GetAttestationDocument
  // 3. Return the CBOR-encoded attestation document

  // For now, return a placeholder that indicates this needs
  // to be run in a real enclave
  throw new Error(
    "Attestation document generation requires Nitro Enclave environment. " +
      "Use the vsock proxy (kmstool-enclave-cli) for KMS operations."
  );
}

/**
 * Validate that we're running in a Nitro Enclave
 *
 * Checks for the presence of the NSM device.
 */
export function isRunningInEnclave(): boolean {
  try {
    // Check for NSM device
    const fs = require("node:fs");
    return fs.existsSync("/dev/nsm");
  } catch {
    return false;
  }
}
