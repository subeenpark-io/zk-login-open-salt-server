/**
 * vsock Client for AWS Nitro Enclaves Communication
 *
 * This module implements a client for communicating with Nitro Enclaves
 * using the vsock (virtual socket) protocol.
 *
 * vsock is a Linux socket type designed for communication between
 * virtual machines and their hosts, or in this case, between the
 * parent EC2 instance and Nitro Enclaves.
 *
 * Protocol:
 * - AF_VSOCK (address family 40)
 * - Parent CID: 3 (always)
 * - Enclave CID: configurable (default 16)
 *
 * @see https://man7.org/linux/man-pages/man7/vsock.7.html
 */

import { spawn } from "node:child_process";

/**
 * Configuration options for VsockClient
 */
export interface VsockClientOptions {
  /** Enclave CID (Context Identifier). Default: 16 */
  enclaveCid: number;
  /** vsock port number. Default: 5000 */
  port: number;
  /** Request timeout in milliseconds. Default: 5000 */
  timeout: number;
}

/**
 * JSON-RPC 2.0 request format
 */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, unknown>;
  id: number;
}

/**
 * JSON-RPC 2.0 response format
 */
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: unknown;
  error?: JsonRpcError;
  id: number;
}

/**
 * JSON-RPC 2.0 error format
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Salt derivation result from enclave
 */
export interface DeriveSaltResult {
  salt: string;
}

/**
 * Attestation information returned by enclave
 */
export interface AttestationInfoResult {
  mode: "nitro-enclave";
  inEnclave: boolean;
  initialized: boolean;
  kmsAttestationVerified: boolean;
  awsRegion: string;
  kmsKeyConfigured: boolean;
  kmsProxyConfigured: boolean;
  timestamp: string;
}

/**
 * Seed initialization parameters for enclave bootstrap
 */
export interface InitializeSeedParams {
  encryptedSeed: string;
  kmsKeyId: string;
  awsRegion?: string;
  kmsProxyEndpoint?: string;
}

export interface InitializePlaintextSeedParams {
  seedHex: string;
}

/**
 * Seed initialization result from enclave
 */
export interface InitializeSeedResult {
  initialized: boolean;
  message?: string;
}

/**
 * Health check result from enclave
 */
export interface HealthCheckResult {
  healthy: boolean;
  message?: string;
}

/**
 * Error thrown when vsock is not available (non-Nitro environment)
 */
export class VsockNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VsockNotAvailableError";
  }
}

/**
 * Error thrown when enclave communication fails
 */
export class EnclaveError extends Error {
  public readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "EnclaveError";
    this.code = code;
  }
}

/**
 * VsockClient for communicating with Nitro Enclaves
 *
 * This client sends JSON-RPC requests to the enclave over vsock.
 * The enclave is responsible for securely storing the master seed
 * and deriving salts.
 *
 * @example
 * ```typescript
 * const client = new VsockClient({
 *   enclaveCid: 16,
 *   port: 5000,
 *   timeout: 5000
 * });
 *
 * const salt = await client.deriveSalt("user123", "app456");
 * ```
 */
export class VsockClient {
  private readonly cid: number;
  private readonly port: number;
  private readonly timeout: number;
  private requestId = 0;

  constructor(options: VsockClientOptions) {
    this.cid = options.enclaveCid;
    this.port = options.port;
    this.timeout = options.timeout;
  }

  /**
   * Derive salt from the enclave
   *
   * @param sub - JWT subject (user identifier)
   * @param aud - JWT audience (application identifier)
   * @returns Hex-encoded salt value (with 0x prefix)
   * @throws {EnclaveError} If the enclave returns an error
   * @throws {VsockNotAvailableError} If vsock is not available
   */
  async deriveSalt(sub: string, aud: string): Promise<string> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method: "deriveSalt",
      params: { sub, aud },
      id: ++this.requestId,
    };

    const response = await this.send(request);

    if (response.error) {
      throw new EnclaveError(response.error.code, response.error.message);
    }

    const result = response.result as DeriveSaltResult;
    return result.salt;
  }

  /**
   * Initialize enclave with encrypted seed and KMS settings
   *
   * This is used during Nitro bootstrap when the enclave starts without
   * ENCRYPTED_SEED in its initial environment.
   */
  async initializeSeed(params: InitializeSeedParams): Promise<InitializeSeedResult> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        encryptedSeed: params.encryptedSeed,
        kmsKeyId: params.kmsKeyId,
        awsRegion: params.awsRegion,
        kmsProxyEndpoint: params.kmsProxyEndpoint,
      },
      id: ++this.requestId,
    };

    const response = await this.send(request);

    if (response.error) {
      throw new EnclaveError(response.error.code, response.error.message);
    }

    return response.result as InitializeSeedResult;
  }

  /**
   * Initialize enclave with plaintext seed (host-side decrypted fallback path)
   */
  async initializePlaintextSeed(params: InitializePlaintextSeedParams): Promise<InitializeSeedResult> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method: "initializePlaintext",
      params: {
        seedHex: params.seedHex,
      },
      id: ++this.requestId,
    };

    const response = await this.send(request);

    if (response.error) {
      throw new EnclaveError(response.error.code, response.error.message);
    }

    return response.result as InitializeSeedResult;
  }

  /**
   * Fetch attestation/runtime info from enclave
   */
  async getAttestationInfo(): Promise<AttestationInfoResult> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method: "attestationInfo",
      params: {},
      id: ++this.requestId,
    };

    const response = await this.send(request);

    if (response.error) {
      throw new EnclaveError(response.error.code, response.error.message);
    }

    return response.result as AttestationInfoResult;
  }

  /**
   * Check enclave health
   *
   * @returns Health check result
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method: "healthCheck",
      params: {},
      id: ++this.requestId,
    };

    try {
      const response = await this.send(request);

      if (response.error) {
        return {
          healthy: false,
          message: response.error.message,
        };
      }

      return response.result as HealthCheckResult;
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Send a JSON-RPC request to the enclave
   */
  private async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const requestJson = JSON.stringify(request);
    const requestBody = Buffer.from(requestJson, "utf-8");
    const lengthPrefix = Buffer.alloc(4);
    lengthPrefix.writeUInt32BE(requestBody.length, 0);
    const payload = Buffer.concat([lengthPrefix, requestBody]);

    const rawResponse = await this.sendViaSocat(payload);
    return this.parseJsonRpcResponse(rawResponse);
  }

  private async sendViaSocat(payload: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const timeoutSeconds = Math.max(1, Math.ceil(this.timeout / 1000));
      const proc = spawn(
        "socat",
        ["-T", String(timeoutSeconds), "-", `VSOCK-CONNECT:${this.cid}:${this.port}`],
        { stdio: ["pipe", "pipe", "pipe"] }
      );

      const stdoutChunks: Buffer[] = [];
      let stderr = "";
      let settled = false;

      const finish = (error?: Error, response?: Buffer) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutHandle);

        if (error) {
          reject(error);
          return;
        }

        resolve(response ?? Buffer.alloc(0));
      };

      const timeoutHandle = setTimeout(() => {
        proc.kill("SIGKILL");
        finish(new Error(`Enclave request timeout after ${this.timeout}ms`));
      }, this.timeout + 500);

      proc.stdout.on("data", (chunk: Buffer | string) => {
        stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      proc.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      proc.on("error", (error) => {
        const errnoError = error as NodeJS.ErrnoException;
        if (errnoError.code === "ENOENT") {
          finish(
            new VsockNotAvailableError(
              "socat is required for Nitro vsock communication but is not installed."
            )
          );
          return;
        }

        finish(new Error(`Failed to execute socat: ${error.message}`));
      });

      proc.on("close", (code) => {
        const response = Buffer.concat(stdoutChunks);
        if (code !== 0 && response.length === 0) {
          const suffix = stderr.trim().length > 0 ? `: ${stderr.trim()}` : "";
          finish(new Error(`Enclave connection failed (socat exit code ${String(code)})${suffix}`));
          return;
        }

        if (response.length === 0) {
          const suffix = stderr.trim().length > 0 ? `: ${stderr.trim()}` : "";
          finish(new Error(`Empty response from enclave${suffix}`));
          return;
        }

        finish(undefined, response);
      });

      proc.stdin.on("error", (error) => {
        finish(new Error(`Failed to write enclave request: ${error.message}`));
      });

      proc.stdin.write(payload);
      proc.stdin.end();
    });
  }

  private parseJsonRpcResponse(rawResponse: Buffer): JsonRpcResponse {
    if (rawResponse.length < 4) {
      throw new Error("Invalid enclave response: missing length prefix");
    }

    const expectedLength = rawResponse.readUInt32BE(0);
    const jsonBuffer = rawResponse.subarray(4);

    if (jsonBuffer.length < expectedLength) {
      throw new Error(
        `Incomplete enclave response: expected ${String(expectedLength)} bytes, got ${String(
          jsonBuffer.length
        )}`
      );
    }

    const jsonPayload = jsonBuffer.subarray(0, expectedLength).toString("utf-8");
    try {
      return JSON.parse(jsonPayload) as JsonRpcResponse;
    } catch (error) {
      throw new Error(`Failed to parse enclave response: ${String(error)}`);
    }
  }
}

/**
 * Create a VsockClient with default options
 */
export function createVsockClient(
  options: Partial<VsockClientOptions> = {}
): VsockClient {
  return new VsockClient({
    enclaveCid: options.enclaveCid ?? 16,
    port: options.port ?? 5000,
    timeout: options.timeout ?? 5000,
  });
}
