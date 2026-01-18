/**
 * 공통 인터페이스 - 모든 팀원이 이 파일을 기준으로 개발합니다.
 */

// ============================================
// JWT 관련 타입 (Person A 담당)
// ============================================

export interface JWTClaims {
  sub: string;
  aud: string | string[];
  iss: string;
  exp: number;
  iat: number;
  nonce?: string | undefined;
}

export interface VerifyResult {
  valid: boolean;
  claims?: JWTClaims | undefined;
  error?: string | undefined;
}

export interface OAuthProvider {
  name: string;
  jwksUri: string;
  issuers: string[];
}

// ============================================
// Salt Provider 타입 (Person B 담당)
// ============================================

export interface SaltProvider {
  name: string;
  type: "local" | "remote" | "hybrid" | "router";

  /**
   * sub와 aud를 기반으로 salt 생성
   * @param sub - JWT subject (사용자 ID)
   * @param aud - JWT audience (앱 ID)
   * @param jwt - 원본 JWT (remote provider에서 필요)
   */
  getSalt(sub: string, aud: string, jwt?: string): Promise<string>;

  /**
   * Provider 상태 확인
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * 리소스 정리 (시드 메모리 해제 등)
   */
  destroy(): Promise<void>;
}

export interface HealthCheckResult {
  healthy: boolean;
  message?: string | undefined;
}

// Seed injection methods
export interface SeedSourceEnv {
  type: "env";
  /** Environment variable name (default: MASTER_SEED) */
  envVar?: string | undefined;
  /** Direct seed value (hex string, for testing only) */
  value?: string | undefined;
}

export interface SeedSourceAws {
  type: "aws";
  /** AWS Secrets Manager secret name */
  secretName: string;
  /** AWS region (default: us-west-2) */
  region?: string | undefined;
  /** JSON key in secret (default: masterSeed) */
  secretKey?: string | undefined;
}

export interface SeedSourceVault {
  type: "vault";
  /** Vault server address */
  address: string;
  /** Secret path in Vault */
  path: string;
  /** Key name in secret (default: masterSeed) */
  key?: string | undefined;
  /** Token env var name (default: VAULT_TOKEN) */
  tokenEnvVar?: string | undefined;
}

export interface SeedSourceFile {
  type: "file";
  /** Path to file containing seed (hex string or JSON) */
  path: string;
  /** JSON key if file is JSON (default: masterSeed) */
  key?: string | undefined;
}

export type SeedSource = SeedSourceEnv | SeedSourceAws | SeedSourceVault | SeedSourceFile;

export interface LocalProviderConfig {
  type: "local";
  /** Seed injection configuration */
  seed: SeedSource;
}

export interface RemoteProviderConfig {
  type: "remote";
  endpoint: string;
  timeout?: number | undefined;
  apiKey?: string | undefined;
  retryCount?: number | undefined;
}

export interface HybridProviderConfig {
  type: "hybrid";
  primary: LocalProviderConfig;
  fallback: RemoteProviderConfig;
  fallbackEnabled: boolean;
  fallbackAfterSeconds: number;
}

export interface RouterRule {
  name: string;
  match: {
    audience?: string;
    issuer?: string;
  };
  provider: string;
}

export interface RouterProviderConfig {
  type: "router";
  defaultProvider: string;
  providers: Record<string, LocalProviderConfig | RemoteProviderConfig>;
  routes: RouterRule[];
}

export type ProviderConfig =
  | LocalProviderConfig
  | RemoteProviderConfig
  | HybridProviderConfig
  | RouterProviderConfig;

// ============================================
// API 관련 타입 (Person C 담당)
// ============================================

export interface SaltRequest {
  jwt: string;
}

export interface SaltResponse {
  salt: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  providers?: Record<string, HealthCheckResult> | undefined;
}

// ============================================
// Config 타입
// ============================================

export interface ServerConfig {
  port: number;
  host?: string | undefined;
}

export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  format?: "json" | "pretty" | undefined;
}

export interface SecurityConfig {
  corsOrigins: string | string[];
  rateLimitMax: number;
  rateLimitWindowMs?: number | undefined;
}

export interface OAuthProviderConfig {
  name: string;
  jwksUri: string;
  issuers: string[];
  enabled?: boolean | undefined;
}

export interface AppConfig {
  server: ServerConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
  provider: ProviderConfig;
  oauth?: OAuthProviderConfig[] | undefined;
}
