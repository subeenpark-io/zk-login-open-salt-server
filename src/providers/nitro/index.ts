/**
 * AWS Nitro Enclaves Module
 *
 * This module provides integration with AWS Nitro Enclaves for secure
 * master seed storage and salt derivation.
 *
 * @see https://docs.aws.amazon.com/enclaves/latest/user/
 */

export {
  VsockClient,
  createVsockClient,
  VsockNotAvailableError,
  EnclaveError,
  type VsockClientOptions,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcError,
  type DeriveSaltResult,
  type HealthCheckResult,
} from "./vsock-client.js";
