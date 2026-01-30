/**
 * vsock Server for Nitro Enclave
 *
 * This module implements a vsock server that listens for JSON-RPC requests
 * from the parent EC2 instance.
 *
 * vsock (Virtual Socket) is the primary communication mechanism between
 * Nitro Enclaves and their parent EC2 instances.
 *
 * Protocol:
 * - AF_VSOCK (address family 40)
 * - Enclave CID: configurable (default 16)
 * - Parent CID: 3 (always)
 * - Message format: 4-byte length prefix + JSON-RPC payload
 */

import * as net from "node:net";

// vsock constants
const AF_VSOCK = 40;
const VMADDR_CID_ANY = -1;

/**
 * JSON-RPC 2.0 request format
 */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, unknown>;
  id: number | string;
}

/**
 * JSON-RPC 2.0 response format
 */
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: unknown;
  error?: JsonRpcError;
  id: number | string | null;
}

/**
 * JSON-RPC 2.0 error format
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// Standard JSON-RPC error codes
export const JsonRpcErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Custom error codes (application-specific)
  NOT_INITIALIZED: -32000,
  DERIVATION_ERROR: -32001,
} as const;

/**
 * Handler function for JSON-RPC methods
 */
export type MethodHandler = (
  params: Record<string, unknown>
) => Promise<unknown> | unknown;

/**
 * VsockServer configuration options
 */
export interface VsockServerOptions {
  /** Port to listen on (default: 5000) */
  port: number;
  /** Maximum connections (default: 10) */
  maxConnections?: number;
}

/**
 * VsockServer for Nitro Enclave
 *
 * Listens for JSON-RPC requests over vsock and dispatches them to
 * registered method handlers.
 *
 * @example
 * ```typescript
 * const server = new VsockServer({ port: 5000 });
 *
 * server.registerMethod("deriveSalt", async (params) => {
 *   const { sub, aud } = params;
 *   return { salt: saltService.deriveSalt(sub, aud) };
 * });
 *
 * await server.start();
 * ```
 */
export class VsockServer {
  private server: net.Server | null = null;
  private readonly port: number;
  private readonly maxConnections: number;
  private readonly methods = new Map<string, MethodHandler>();
  private connectionCount = 0;

  constructor(options: VsockServerOptions) {
    this.port = options.port;
    this.maxConnections = options.maxConnections ?? 10;
  }

  /**
   * Register a method handler
   *
   * @param name - Method name
   * @param handler - Handler function
   */
  registerMethod(name: string, handler: MethodHandler): void {
    this.methods.set(name, handler);
    console.log(`[vsock-server] Registered method: ${name}`);
  }

  /**
   * Start the vsock server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = net.createServer((socket) => {
          this.handleConnection(socket);
        });

        // Configure server
        this.server.maxConnections = this.maxConnections;

        // Error handling
        this.server.on("error", (error) => {
          console.error("[vsock-server] Server error:", error.message);
          reject(error);
        });

        // Start listening on vsock
        // Note: In a real Nitro Enclave, this would use AF_VSOCK
        // For development/testing, we use a regular TCP socket
        this.server.listen(
          {
            // @ts-expect-error - Using vsock-specific options
            family: AF_VSOCK,
            host: String(VMADDR_CID_ANY),
            port: this.port,
          },
          () => {
            console.log(`[vsock-server] Listening on vsock port ${this.port}`);
            resolve();
          }
        );
      } catch (error) {
        // Fallback to TCP for development/testing
        console.log("[vsock-server] vsock not available, falling back to TCP");
        this.server = net.createServer((socket) => {
          this.handleConnection(socket);
        });

        this.server.listen(this.port, "127.0.0.1", () => {
          console.log(`[vsock-server] Listening on TCP port ${this.port} (development mode)`);
          resolve();
        });
      }
    });
  }

  /**
   * Stop the vsock server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          reject(error);
        } else {
          this.server = null;
          console.log("[vsock-server] Stopped");
          resolve();
        }
      });
    });
  }

  /**
   * Handle an incoming connection
   */
  private handleConnection(socket: net.Socket): void {
    this.connectionCount++;
    const connectionId = this.connectionCount;
    console.log(`[vsock-server] Connection #${connectionId} established`);

    let buffer = Buffer.alloc(0);

    socket.on("data", async (data) => {
      buffer = Buffer.concat([buffer, data]);

      // Process complete messages
      while (buffer.length >= 4) {
        const messageLength = buffer.readUInt32BE(0);

        if (buffer.length < 4 + messageLength) {
          // Wait for more data
          break;
        }

        // Extract the message
        const messageData = buffer.subarray(4, 4 + messageLength);
        buffer = buffer.subarray(4 + messageLength);

        // Process the request
        const response = await this.processRequest(messageData.toString());
        this.sendResponse(socket, response);
      }
    });

    socket.on("error", (error) => {
      console.error(`[vsock-server] Connection #${connectionId} error:`, error.message);
    });

    socket.on("close", () => {
      console.log(`[vsock-server] Connection #${connectionId} closed`);
    });
  }

  /**
   * Process a JSON-RPC request
   */
  private async processRequest(data: string): Promise<JsonRpcResponse> {
    let request: JsonRpcRequest;
    let requestId: number | string | null = null;

    try {
      // Parse JSON-RPC request
      request = JSON.parse(data);
      requestId = request.id ?? null;

      // Validate request format
      if (request.jsonrpc !== "2.0" || !request.method) {
        return this.createErrorResponse(
          requestId,
          JsonRpcErrorCodes.INVALID_REQUEST,
          "Invalid JSON-RPC request"
        );
      }

      // Find handler
      const handler = this.methods.get(request.method);
      if (!handler) {
        return this.createErrorResponse(
          requestId,
          JsonRpcErrorCodes.METHOD_NOT_FOUND,
          `Method not found: ${request.method}`
        );
      }

      // Execute handler
      const result = await handler(request.params ?? {});
      return this.createSuccessResponse(requestId, result);
    } catch (error) {
      // JSON parse error
      if (error instanceof SyntaxError) {
        return this.createErrorResponse(
          requestId,
          JsonRpcErrorCodes.PARSE_ERROR,
          "Parse error"
        );
      }

      // Other errors
      const message = error instanceof Error ? error.message : "Internal error";
      return this.createErrorResponse(
        requestId,
        JsonRpcErrorCodes.INTERNAL_ERROR,
        message
      );
    }
  }

  /**
   * Send a response to the client
   */
  private sendResponse(socket: net.Socket, response: JsonRpcResponse): void {
    const responseData = JSON.stringify(response);
    const responseBuffer = Buffer.from(responseData);

    // Send length-prefixed message
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32BE(responseBuffer.length, 0);

    socket.write(lengthBuffer);
    socket.write(responseBuffer);
  }

  /**
   * Create a success response
   */
  private createSuccessResponse(
    id: number | string | null,
    result: unknown
  ): JsonRpcResponse {
    return {
      jsonrpc: "2.0",
      result,
      id,
    };
  }

  /**
   * Create an error response
   */
  private createErrorResponse(
    id: number | string | null,
    code: number,
    message: string,
    data?: unknown
  ): JsonRpcResponse {
    return {
      jsonrpc: "2.0",
      error: {
        code,
        message,
        ...(data !== undefined && { data }),
      },
      id,
    };
  }
}

/**
 * Create a new VsockServer instance
 */
export function createVsockServer(options: VsockServerOptions): VsockServer {
  return new VsockServer(options);
}
