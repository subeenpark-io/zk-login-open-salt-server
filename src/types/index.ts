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
  type: "local" | "remote" | "hybrid";

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

export interface ProviderConfig {
  type: "local" | "remote" | "hybrid";
  // local
  seed?: string | undefined;
  seedSource?: "env" | "aws" | "vault" | undefined;
  // remote
  endpoint?: string | undefined;
  timeout?: number | undefined;
  apiKey?: string | undefined;
  // hybrid
  primary?: ProviderConfig | undefined;
  fallback?: ProviderConfig | undefined;
}

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

export interface AppConfig {
  port: number;
  logLevel: "debug" | "info" | "warn" | "error";
  corsOrigins: string;
  rateLimitMax: number;
  provider: ProviderConfig;
}
