# Person A Task Report: Salt Provider 구현

## 개요

이 문서는 zkLogin Salt Server의 Provider 시스템 구현에 대한 상세 코드 분석 리포트입니다.

---

## 목차

1. [타입 정의 (`src/types/index.ts`)](#1-타입-정의)
2. [Local Provider (`src/providers/local.provider.ts`)](#2-local-provider)
3. [Remote Provider (`src/providers/remote.provider.ts`)](#3-remote-provider)
4. [Hybrid Provider (`src/providers/hybrid.provider.ts`)](#4-hybrid-provider)
5. [Router Provider (`src/providers/router.provider.ts`)](#5-router-provider)
6. [Provider Factory (`src/providers/index.ts`)](#6-provider-factory)
7. [Salt Route (`src/routes/salt.route.ts`)](#7-salt-route)
8. [Config Loader (`src/config/salt-providers.ts`)](#8-config-loader)
9. [테스트 파일](#9-테스트-파일)

---

## 1. 타입 정의

**파일**: `src/types/index.ts`

이 파일은 프로젝트의 "계약서" 역할을 합니다. 모든 개발자가 이 타입을 기준으로 개발합니다.

### JWT 관련 타입

```typescript
export interface JWTClaims {
  sub: string;              // Subject - 사용자 고유 ID (예: Google ID)
  aud: string | string[];   // Audience - 이 JWT를 받을 앱 ID (배열일 수도 있음)
  iss: string;              // Issuer - JWT 발급자 (예: "https://accounts.google.com")
  exp: number;              // Expiration - 만료 시간 (Unix timestamp)
  iat: number;              // Issued At - 발급 시간 (Unix timestamp)
  nonce?: string;           // 선택적 - 재사용 공격 방지용 랜덤값
}
```
- OAuth Provider(Google 등)가 발급한 JWT 토큰의 payload 구조를 정의

```typescript
export interface VerifyResult {
  valid: boolean;           // JWT 검증 성공 여부
  claims?: JWTClaims;       // 성공시 파싱된 클레임
  error?: string;           // 실패시 에러 메시지
}
```
- JWT 검증 결과를 담는 객체

```typescript
export interface OAuthProvider {
  name: string;             // "google", "facebook" 등
  jwksUri: string;          // 공개키 조회 URL (JWT 서명 검증용)
  issuers: string[];        // 허용된 issuer 목록
}
```
- 지원하는 OAuth Provider 정보

---

### Salt Provider 인터페이스

```typescript
export interface SaltProvider {
  name: string;             // Provider 이름 (로깅용)
  type: "local" | "remote" | "hybrid" | "router";  // 4가지 모드
```
- 모든 Provider가 구현해야 하는 공통 인터페이스

```typescript
  getSalt(sub: string, aud: string, jwt?: string): Promise<string>;
```
- **핵심 메서드**: 사용자ID + 앱ID → Salt 생성
- `jwt`는 Remote Provider가 원격 서버에 전달할 때 필요

```typescript
  healthCheck(): Promise<HealthCheckResult>;
```
- Provider가 정상 작동 중인지 확인 (모니터링용)

```typescript
  destroy(): Promise<void>;
```
- 종료 시 리소스 정리 (특히 메모리에서 시드 삭제)

```typescript
export interface HealthCheckResult {
  healthy: boolean;         // 정상 여부
  message?: string;         // 추가 설명 (에러 시 원인)
}
```

---

### Seed Source 타입 (시드를 어디서 가져올지)

```typescript
export interface SeedSourceEnv {
  type: "env";
  envVar?: string;          // 환경변수 이름 (기본: MASTER_SEED)
  value?: string;           // 직접 값 지정 (테스트용만!)
}
```
- 환경변수에서 시드 읽기 (가장 간단한 방법)

```typescript
export interface SeedSourceAws {
  type: "aws";
  secretName: string;       // AWS Secrets Manager 시크릿 이름
  region?: string;          // AWS 리전 (기본: us-west-2)
  secretKey?: string;       // JSON 형식일 때 키 이름
}
```
- AWS Secrets Manager에서 시드 가져오기 (프로덕션 권장)

```typescript
export interface SeedSourceVault {
  type: "vault";
  address: string;          // Vault 서버 주소
  path: string;             // 시크릿 경로
  key?: string;             // JSON 키 이름
  tokenEnvVar?: string;     // 인증 토큰 환경변수 이름
}
```
- HashiCorp Vault에서 시드 가져오기

```typescript
export interface SeedSourceFile {
  type: "file";
  path: string;             // 파일 경로
  key?: string;             // JSON 파일일 때 키 이름
}
```
- 파일에서 시드 읽기

```typescript
export type SeedSource = SeedSourceEnv | SeedSourceAws | SeedSourceVault | SeedSourceFile;
```
- 4가지 중 하나 (Union Type)

---

### Provider Config 타입들

```typescript
export interface LocalProviderConfig {
  type: "local";
  seed: SeedSource;         // 위의 4가지 시드 소스 중 하나
}
```
- Local Provider 설정 (자체 시드로 Salt 생성)

```typescript
export interface RemoteProviderConfig {
  type: "remote";
  endpoint: string;         // 원격 Salt 서버 URL
  timeout?: number;         // 요청 타임아웃 (ms)
  apiKey?: string;          // 인증 API 키
  retryCount?: number;      // 실패시 재시도 횟수
}
```
- Remote Provider 설정 (외부 서버로 프록시)

```typescript
export interface HybridProviderConfig {
  type: "hybrid";
  primary: LocalProviderConfig;      // 기본: Local
  fallback: RemoteProviderConfig;    // 백업: Remote
  fallbackEnabled: boolean;          // Fallback 활성화 여부
  fallbackAfterSeconds: number;      // Primary 실패 후 몇 초간 Fallback 사용
}
```
- Hybrid Provider 설정 (Local 실패시 Remote로 전환)

```typescript
export interface RouterRule {
  name: string;             // 규칙 이름 (로깅용)
  match: {
    audience?: string;      // aud 패턴 매칭 (예: "*.mycompany.com")
    issuer?: string;        // iss 패턴 매칭
  };
  provider: string;         // 매칭시 사용할 Provider 이름
}
```
- 라우팅 규칙 (어떤 조건에서 어떤 Provider 사용)

```typescript
export interface RouterProviderConfig {
  type: "router";
  defaultProvider: string;  // 매칭 안될 때 기본 Provider
  providers: Record<string, LocalProviderConfig | RemoteProviderConfig>;
  routes: RouterRule[];     // 라우팅 규칙 배열
}
```
- Router Provider 설정 (멀티테넌트)

```typescript
export type ProviderConfig =
  | LocalProviderConfig
  | RemoteProviderConfig
  | HybridProviderConfig
  | RouterProviderConfig;
```
- 4가지 Provider Config의 Union Type

---

### API 타입

```typescript
export interface SaltRequest {
  jwt: string;              // 클라이언트가 보내는 JWT
}

export interface SaltResponse {
  salt: string;             // 생성된 Salt (0x로 시작하는 hex)
}

export interface ErrorResponse {
  error: string;            // 에러 코드 (예: "invalid_jwt")
  message: string;          // 사람이 읽을 수 있는 메시지
}

export interface HealthResponse {
  status: "ok" | "degraded" | "error";  // 서버 상태
  timestamp: string;                     // 응답 시간
  providers?: Record<string, HealthCheckResult>;  // Provider별 상태
}
```

---

### App Config 타입

```typescript
export interface ServerConfig {
  port: number;             // 서버 포트 (예: 3000)
  host?: string;            // 바인딩 호스트 (예: "0.0.0.0")
}

export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";  // 로그 레벨
  format?: "json" | "pretty";                   // 출력 형식
}

export interface SecurityConfig {
  corsOrigins: string | string[];  // 허용할 도메인
  rateLimitMax: number;            // 분당 최대 요청 수
  rateLimitWindowMs?: number;      // Rate limit 윈도우 (ms)
}

export interface AppConfig {
  server: ServerConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
  provider: ProviderConfig;        // Salt Provider 설정
  oauth?: OAuthProviderConfig[];   // OAuth Provider 목록
}
```
- 전체 앱 설정 구조

---

## 2. Local Provider

**파일**: `src/providers/local.provider.ts`

자체 시드로 Salt를 직접 생성하는 핵심 Provider입니다.

### Import 및 클래스 정의

```typescript
import { readFileSync } from "node:fs";
import type {
  HealthCheckResult,
  LocalProviderConfig,
  SaltProvider,
  SeedSource,
  SeedSourceAws,
  SeedSourceFile,
  SeedSourceVault,
} from "../types/index.js";
import { deriveSalt } from "../services/seed.service.js";
import { bytesToHex, hexToBytes } from "../utils/crypto.js";
```
- 타입과 유틸리티 함수 import
- `readFileSync`: 파일에서 시드 읽기용

```typescript
export class LocalProvider implements SaltProvider {
  readonly name = "local";
  readonly type = "local";
  private seed: Uint8Array;  // 32바이트 마스터 시드 (메모리에 보관)
```
- SaltProvider 인터페이스를 구현하는 클래스
- `seed`는 private - 외부에서 접근 불가

### 생성자 및 팩토리 메서드

```typescript
  private constructor(seed: Uint8Array) {
    this.seed = seed;
  }
```
- **private 생성자**: `new LocalProvider()` 직접 호출 불가
- 반드시 `LocalProvider.create()`를 통해서만 생성

```typescript
  static async create(config: LocalProviderConfig): Promise<LocalProvider> {
    const seed = await loadSeed(config.seed);
    return new LocalProvider(seed);
  }
```
- **팩토리 메서드**: 비동기로 시드 로드 후 인스턴스 생성
- 왜 팩토리? constructor는 async가 안 되기 때문

### 핵심 메서드

```typescript
  async getSalt(sub: string, aud: string, _jwt?: string): Promise<string> {
    const salt = deriveSalt(this.seed, sub, aud);
    return bytesToHex(salt);
  }
```
- **핵심 로직**: HKDF(seed, sub:aud) → 32바이트 salt → hex 문자열
- `_jwt`는 사용 안 함 (Remote용 파라미터)

```typescript
  async healthCheck(): Promise<HealthCheckResult> {
    if (this.seed.length !== 32) {
      return { healthy: false, message: "Seed must be 32 bytes" };
    }
    return { healthy: true };
  }
```
- 시드가 올바른 길이(32바이트)인지 확인

```typescript
  async destroy(): Promise<void> {
    this.seed.fill(0);  // 모든 바이트를 0으로 덮어씀
  }
```
- **보안**: 종료 시 메모리에서 시드 삭제 (민감 정보 유출 방지)

---

### 시드 로딩 함수들

```typescript
async function loadSeed(source: SeedSource): Promise<Uint8Array> {
  switch (source.type) {
    case "env":
      return loadSeedFromEnv(source.envVar, source.value);
    case "aws":
      return loadSeedFromAWS(source);
    case "vault":
      return loadSeedFromVault(source);
    case "file":
      return loadSeedFromFile(source);
    default:
      throw new Error(`Unknown seed source type: ${(source as { type: string }).type}`);
  }
}
```
- source.type에 따라 적절한 로더 호출

```typescript
function loadSeedFromEnv(envVar?: string, directValue?: string): Uint8Array {
  const value = directValue ?? process.env[envVar ?? "MASTER_SEED"];

  if (!value) {
    const varName = envVar ?? "MASTER_SEED";
    throw new Error(`${varName} environment variable is required`);
  }

  const bytes = hexToBytes(value);
  return ensureSeedLength(bytes);
}
```
- 환경변수에서 hex 문자열 → 바이트 배열 변환
- `directValue`는 테스트용 (환경변수 없이 직접 값 주입)

```typescript
async function loadSeedFromAWS(source: SeedSourceAws): Promise<Uint8Array> {
  if (!source.secretName) {
    throw new Error("AWS secretName is required for AWS seed source");
  }

  // AWS SDK를 동적 import (tree-shaking 최적화)
  const { SecretsManagerClient, GetSecretValueCommand } =
    await import("@aws-sdk/client-secrets-manager");

  const client = new SecretsManagerClient({ region: source.region ?? "us-west-2" });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: source.secretName })
  );
```
- AWS Secrets Manager에서 시크릿 조회
- 동적 import로 AWS SDK를 사용하지 않으면 번들에 포함 안됨

```typescript
  if (response.SecretString) {
    return parseSeedFromString(response.SecretString, source.secretKey);
  }

  if (response.SecretBinary) {
    const buffer = Buffer.from(response.SecretBinary);
    if (buffer.length === 32) {
      return new Uint8Array(buffer);  // 바이너리로 직접 저장된 경우
    }
    return parseSeedFromString(buffer.toString("utf-8"), source.secretKey);
  }

  throw new Error("AWS secret is empty");
}
```
- 문자열 또는 바이너리 형식 모두 지원

```typescript
async function loadSeedFromVault(source: SeedSourceVault): Promise<Uint8Array> {
  if (!source.address) {
    throw new Error("Vault address is required for Vault seed source");
  }

  if (!source.path) {
    throw new Error("Vault path is required for Vault seed source");
  }

  const tokenEnvVar = source.tokenEnvVar ?? "VAULT_TOKEN";
  const token = process.env[tokenEnvVar];
  if (!token) {
    throw new Error(`${tokenEnvVar} is required for Vault seed source`);
  }

  const baseUrl = source.address.replace(/\/$/, "");
  const path = source.path.replace(/^\/+/, "");
  const response = await fetch(`${baseUrl}/v1/${path}`, {
    headers: {
      "X-Vault-Token": token,
    },
  });
```
- HashiCorp Vault HTTP API 호출
- 토큰은 환경변수에서 읽음 (보안)

```typescript
  // ... 응답 파싱

  const keyName = source.key ?? "masterSeed";
  const masterSeed = payload[keyName] ?? payload["seed"];
  if (typeof masterSeed !== "string") {
    throw new Error(`Vault secret must contain ${keyName} or seed`);
  }

  return parseSeedFromString(masterSeed);
}
```
- Vault 응답에서 시드 추출

```typescript
function loadSeedFromFile(source: SeedSourceFile): Uint8Array {
  if (!source.path) {
    throw new Error("File path is required for file seed source");
  }

  const content = readFileSync(source.path, "utf-8").trim();
  return parseSeedFromString(content, source.key);
}
```
- 파일에서 시드 읽기 (동기)

```typescript
function parseSeedFromString(value: string, keyName?: string): Uint8Array {
  const trimmed = value.trim();

  // JSON 형식 지원: {"masterSeed": "0x123..."}
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const candidate = (keyName ? parsed[keyName] : parsed["masterSeed"]) ?? parsed["seed"];

      if (typeof candidate === "string") {
        return ensureSeedLength(hexToBytes(candidate));
      }
    } catch {
      // JSON 파싱 실패시 hex로 시도
    }
  }

  // 순수 hex 문자열
  return ensureSeedLength(hexToBytes(trimmed));
}
```
- JSON 또는 순수 hex 문자열 모두 파싱 가능

```typescript
function ensureSeedLength(bytes: Uint8Array): Uint8Array {
  if (bytes.length !== 32) {
    throw new Error("MASTER_SEED must be 32 bytes (64 hex characters)");
  }
  return bytes;
}
```
- 시드는 반드시 32바이트여야 함 (256비트)

---

## 3. Remote Provider

**파일**: `src/providers/remote.provider.ts`

외부 Salt 서버(예: Mysten Labs)로 요청을 프록시하는 Provider입니다.

### 상수 및 클래스 정의

```typescript
const DEFAULT_TIMEOUT_MS = 10000;   // 10초
const DEFAULT_RETRY_COUNT = 0;       // 재시도 안함

export class RemoteProvider implements SaltProvider {
  readonly name = "remote";
  readonly type = "remote";
  private config: RemoteProviderConfig;

  constructor(config: RemoteProviderConfig) {
    this.config = config;
  }
```
- 설정만 저장 (시드 없음, 외부 서버에 의존)

### 재시도 로직

```typescript
  async getSalt(sub: string, aud: string, jwt?: string): Promise<string> {
    const maxAttempts = (this.config.retryCount ?? DEFAULT_RETRY_COUNT) + 1;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.requestSalt(sub, aud, jwt);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("...");
        if (attempt >= maxAttempts) break;
      }
    }

    throw lastError ?? new Error("Remote provider request failed");
  }
```
- **재시도 로직**: retryCount만큼 재시도 후 실패

### HTTP 요청

```typescript
  private async requestSalt(sub: string, aud: string, jwt?: string): Promise<string> {
    const controller = new AbortController();
    const timeoutMs = this.config.timeout ?? DEFAULT_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
```
- **타임아웃 처리**: AbortController로 요청 취소

```typescript
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.config.apiKey) {
        headers["Authorization"] = `Bearer ${this.config.apiKey}`;
      }
```
- API 키가 있으면 Authorization 헤더에 추가

```typescript
      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ sub, aud, jwt }),
        signal: controller.signal,  // 타임아웃용 시그널
      });

      if (!response.ok) {
        throw new Error(`Remote salt server returned ${response.status}`);
      }

      const data = await response.json();
      if (!data.salt) {
        throw new Error("Remote salt server response missing salt");
      }

      return data.salt;
    } finally {
      clearTimeout(timeout);  // 타임아웃 정리
    }
  }
```
- 외부 서버에 POST 요청 → salt 반환

### 헬스체크

```typescript
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const response = await fetch(this.endpointFor("/health"), { method: "GET" });
      if (!response.ok) {
        return { healthy: false, message: `... ${response.status}` };
      }
      return { healthy: true };
    } catch (error) {
      return { healthy: false, message: error.message };
    }
  }
```
- 원격 서버의 /health 엔드포인트 호출

```typescript
  private endpointFor(path: string): string {
    // endpoint가 "/get_salt"로 끝나면 → "/health"로 교체
    if (this.config.endpoint.endsWith("/get_salt")) {
      return this.config.endpoint.replace("/get_salt", path);
    }
    return `${this.config.endpoint}${path}`;
  }
```
- Mysten Labs 서버 URL 형식 지원 (get_salt → health 변환)

```typescript
  async destroy(): Promise<void> {
    // Remote는 정리할 리소스 없음
  }
```

---

## 4. Hybrid Provider

**파일**: `src/providers/hybrid.provider.ts`

Primary(Local) + Fallback(Remote) 구조로 장애 대응을 하는 Provider입니다.

### 클래스 정의

```typescript
export class HybridProvider implements SaltProvider {
  readonly name = "hybrid";
  readonly type = "hybrid";
  private primary: LocalProvider;
  private fallback: RemoteProvider;
  private fallbackEnabled: boolean;
  private fallbackAfterSeconds: number;
  private primaryFailedAt: number | null = null;  // 마지막 실패 시간
```
- Primary(Local) + Fallback(Remote) 조합
- `primaryFailedAt`: Circuit Breaker 패턴 구현용

### 팩토리 메서드

```typescript
  static async create(config: HybridProviderConfig): Promise<HybridProvider> {
    const primary = await LocalProvider.create(config.primary);
    const fallback = new RemoteProvider(config.fallback);
    return new HybridProvider(primary, fallback, ...);
  }
```
- 두 Provider를 모두 생성

### 핵심 로직 (Circuit Breaker)

```typescript
  async getSalt(sub: string, aud: string, jwt?: string): Promise<string> {
    // 최근에 Primary가 실패했으면 바로 Fallback 사용
    if (this.shouldUseFallback()) {
      logger.info("Using fallback provider due to recent primary failure");
      return this.fallback.getSalt(sub, aud, jwt);
    }
```
- **Circuit Breaker 패턴**: Primary 실패 후 일정 시간 동안 Fallback만 사용
- 실패한 Primary에 계속 요청하지 않아 응답 시간 개선

```typescript
    try {
      const salt = await this.primary.getSalt(sub, aud);
      this.primaryFailedAt = null;  // 성공시 실패 기록 초기화
      return salt;
    } catch (error) {
      this.primaryFailedAt = Date.now();  // 실패 시간 기록
      logger.error("Primary provider failed", { error });

      if (this.fallbackEnabled) {
        logger.info("Falling back to remote provider");
        return this.fallback.getSalt(sub, aud, jwt);
      }

      throw error;
    }
  }
```
- Primary 시도 → 실패시 Fallback

```typescript
  private shouldUseFallback(): boolean {
    if (!this.fallbackEnabled || this.primaryFailedAt === null) {
      return false;
    }

    const elapsedSeconds = (Date.now() - this.primaryFailedAt) / 1000;
    return elapsedSeconds < this.fallbackAfterSeconds;
  }
```
- 마지막 실패로부터 N초 이내면 Fallback 사용
- 예: 60초 설정이면, Primary 실패 후 1분간 Fallback만 사용

```typescript
  async destroy(): Promise<void> {
    await Promise.all([this.primary.destroy(), this.fallback.destroy()]);
  }
```
- 두 Provider 모두 정리

---

## 5. Router Provider

**파일**: `src/providers/router.provider.ts`

멀티테넌트 환경에서 aud(audience)에 따라 다른 Provider로 라우팅하는 Provider입니다.

### 클래스 정의

```typescript
export class RouterProvider implements SaltProvider {
  readonly name = "router";
  readonly type = "router";
  private providers: Map<string, SaltProvider>;  // 이름 → Provider 맵
  private routes: RouterRule[];
  private defaultProvider: string;
```
- 여러 Provider를 관리하고 조건에 따라 라우팅

### 팩토리 메서드

```typescript
  static async create(config: RouterProviderConfig): Promise<RouterProvider> {
    const providers = new Map<string, SaltProvider>();

    // 설정된 모든 Provider 생성
    for (const [name, providerConfig] of Object.entries(config.providers)) {
      const provider = await createProviderFromConfig(providerConfig);
      providers.set(name, provider);
    }

    return new RouterProvider(providers, config.routes, config.defaultProvider);
  }
```
- 설정에 명시된 모든 Provider를 미리 생성

### 라우팅 로직

```typescript
  async getSalt(sub: string, aud: string, jwt?: string): Promise<string> {
    const providerName = this.resolveProvider(aud);  // aud로 Provider 결정
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    logger.debug("Routing to provider", { provider: providerName, aud });
    return provider.getSalt(sub, aud, jwt);
  }
```
- aud를 보고 어떤 Provider를 사용할지 결정

```typescript
  private resolveProvider(aud: string): string {
    for (const rule of this.routes) {
      if (this.matchesRule(rule, aud)) {
        return rule.provider;
      }
    }
    return this.defaultProvider;  // 매칭 없으면 기본 Provider
  }
```
- 규칙을 순서대로 검사

```typescript
  private matchesRule(rule: RouterRule, aud: string): boolean {
    if (rule.match.audience) {
      // "*"를 ".*"로 변환하여 정규식 매칭
      const pattern = rule.match.audience.replace(/\*/g, ".*");
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(aud)) {
        return true;
      }
    }
    return false;
  }
```
- 와일드카드 패턴 지원 (예: `*.mycompany.com`)

### 헬스체크

```typescript
  async healthCheck(): Promise<HealthCheckResult> {
    const results = await Promise.all(
      Array.from(this.providers.values()).map((p) => p.healthCheck())
    );
    // 하나라도 healthy면 전체 healthy (graceful degradation)
    const healthy = results.some((r) => r.healthy);
    return { healthy, message: results.find((r) => r.message)?.message };
  }
```
- 모든 Provider 헬스체크

---

## 6. Provider Factory

**파일**: `src/providers/index.ts`

설정에 따라 적절한 Provider를 생성하는 팩토리 함수입니다.

```typescript
export async function createProvider(config: ProviderConfig): Promise<SaltProvider> {
  switch (config.type) {
    case "local": {
      const { LocalProvider } = await import("./local.provider.js");
      return LocalProvider.create(config);
    }
    case "remote": {
      const { RemoteProvider } = await import("./remote.provider.js");
      return new RemoteProvider(config);
    }
    case "hybrid": {
      const { HybridProvider } = await import("./hybrid.provider.js");
      return HybridProvider.create(config);
    }
    case "router": {
      const { RouterProvider } = await import("./router.provider.js");
      return RouterProvider.create(config);
    }
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}
```
- **팩토리 패턴**: config.type에 따라 적절한 Provider 생성
- **동적 import**: 사용하는 Provider만 로드 (번들 크기 최적화)

---

## 7. Salt Route

**파일**: `src/routes/salt.route.ts`

POST /salt API 엔드포인트를 정의합니다.

### 싱글톤 Provider

```typescript
export const saltRoutes = new Hono();

let provider: SaltProvider | null = null;  // 싱글톤

async function getProvider(): Promise<SaltProvider> {
  if (!provider) {
    provider = await createProvider(config.saltProvider);
  }
  return provider;
}
```
- Provider를 한 번만 생성 (Lazy Singleton)

### API 핸들러

```typescript
saltRoutes.post("/salt", async (c) => {
  try {
    const body = await c.req.json<SaltRequest>();

    // 1. JWT 필수 체크
    if (!body.jwt) {
      return c.json<ErrorResponse>({
        error: "missing_jwt",
        message: "JWT is required",
      }, 400);
    }
```
- POST /salt 엔드포인트

```typescript
    // 2. JWT 검증 (서명, 만료 등)
    const verified = await verifyJWT(body.jwt);
    const { sub, aud } = verified.payload;

    // 3. sub 클레임 필수
    if (!sub) {
      return c.json<ErrorResponse>({
        error: "invalid_jwt",
        message: "JWT missing subject claim",
      }, 400);
    }

    // 4. aud 클레임 필수 (배열이면 첫 번째 사용)
    const audience = Array.isArray(aud) ? aud[0] : aud;
    if (!audience) {
      return c.json<ErrorResponse>({
        error: "invalid_jwt",
        message: "JWT missing audience claim",
      }, 400);
    }
```
- JWT 검증 및 클레임 추출

```typescript
    // 5. Salt 생성
    const saltProvider = await getProvider();
    const salt = await saltProvider.getSalt(sub, audience, body.jwt);

    logger.info("Salt generated successfully", {
      provider: verified.provider.name,
    });

    return c.json<SaltResponse>({ salt });
```
- Provider에 Salt 생성 요청 후 응답

### 에러 처리

```typescript
  } catch (error) {
    if (error instanceof JWTError) {
      return c.json<ErrorResponse>({
        error: error.code,
        message: error.message,
      }, 401);
    }

    logger.error("Salt generation failed", { error });

    return c.json<ErrorResponse>({
      error: "internal_error",
      message: "An error occurred while generating salt",
    }, 500);
  }
});
```
- JWT 에러는 401, 나머지는 500

---

## 8. Config Loader

**파일**: `src/config/salt-providers.ts`

> **Note**: 이 파일은 deprecated 되었으며, yaml-loader.ts 사용을 권장합니다.

환경변수를 읽어서 Provider 설정 객체를 생성합니다.

### 모드 선택

```typescript
export function loadSaltProviderConfig(): SaltProviderConfig {
  const mode = process.env["SALT_PROVIDER_MODE"] ?? "local";

  switch (mode) {
    case "local":   return loadLocalConfig();
    case "remote":  return loadRemoteConfig();
    case "hybrid":  return loadHybridConfig();
    case "router":  return loadRouterConfig();
    default:
      throw new Error(`Unknown salt provider mode: ${mode}`);
  }
}
```
- 환경변수 `SALT_PROVIDER_MODE`로 모드 결정

### Local Config 로더

```typescript
function loadLocalConfig(): LocalProviderConfig {
  const seedSource = process.env["SEED_SOURCE"] ?? "env";

  switch (seedSource) {
    case "aws":
      return {
        type: "local",
        seed: {
          type: "aws",
          secretName: process.env["AWS_SECRET_NAME"] ?? "",
          region: process.env["AWS_REGION"] ?? "us-west-2",
        },
      };

    case "vault":
      return {
        type: "local",
        seed: {
          type: "vault",
          address: process.env["VAULT_ADDR"] ?? "",
          path: process.env["VAULT_PATH"] ?? "",
          tokenEnvVar: "VAULT_TOKEN",
        },
      };

    case "file":
      return {
        type: "local",
        seed: {
          type: "file",
          path: process.env["SEED_FILE_PATH"] ?? "",
        },
      };

    case "env":
    default:
      return {
        type: "local",
        seed: {
          type: "env",
          envVar: "MASTER_SEED",
          value: process.env["MASTER_SEED"],
        },
      };
  }
}
```
- SEED_SOURCE에 따라 적절한 seed 설정 생성

### Hybrid Config 로더

```typescript
function loadHybridConfig(): HybridProviderConfig {
  return {
    type: "hybrid",
    primary: loadLocalConfig(),
    fallback: {
      type: "remote",
      endpoint: process.env["HYBRID_FALLBACK_ENDPOINT"]
        ?? "https://salt.api.mystenlabs.com/get_salt",  // 기본: Mysten Labs
      timeout: 10000,
    },
    fallbackEnabled: process.env["HYBRID_FALLBACK_ENABLED"] !== "false",
    fallbackAfterSeconds: parseInt(process.env["HYBRID_FALLBACK_AFTER_SECONDS"] ?? "60"),
  };
}
```
- Hybrid: Local + Mysten Labs 백업

---

## 9. 테스트 파일

### Local Provider 테스트

**파일**: `src/providers/local.provider.test.ts`

```typescript
const SEED_HEX = "0x" + "11".repeat(32);  // 테스트용 시드

it("derives deterministic salt for same inputs", async () => {
  const provider = await LocalProvider.create({
    type: "local",
    seed: { type: "env", value: SEED_HEX },
  });
  const first = await provider.getSalt("user-1", "aud-1");
  const second = await provider.getSalt("user-1", "aud-1");

  expect(first).toBe(second);  // 같은 입력 → 같은 결과
  await provider.destroy();
});
```
- **결정론적 테스트**: 같은 입력이면 항상 같은 salt

```typescript
it("returns 0x-prefixed salt", async () => {
  // ...
  expect(salt.startsWith("0x")).toBe(true);
});
```
- Salt가 `0x` 접두사를 가지는지 확인

```typescript
it("clears seed on destroy", async () => {
  // ...
  const seedRef = provider["seed"] as Uint8Array;
  await provider.destroy();

  expect(seedRef.every((value) => value === 0)).toBe(true);
});
```
- **보안 테스트**: destroy 후 시드가 0으로 클리어됨

### Remote Provider 테스트

**파일**: `src/providers/remote.provider.test.ts`

```typescript
it("retries and returns salt on success", async () => {
  fetchMock
    .mockResolvedValueOnce({ ok: false, status: 500 })  // 첫 번째: 실패
    .mockResolvedValueOnce({ ok: true, json: ... });    // 두 번째: 성공

  const provider = new RemoteProvider({ retryCount: 1 });
  const salt = await provider.getSalt(...);

  expect(fetchMock).toHaveBeenCalledTimes(2);  // 재시도 확인
});
```
- **재시도 테스트**: 첫 번째 실패 후 두 번째 성공

```typescript
it("returns unhealthy result when health endpoint fails", async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });

  const provider = new RemoteProvider({ type: "remote", endpoint });
  const result = await provider.healthCheck();

  expect(result.healthy).toBe(false);
  expect(result.message).toContain("503");
});
```
- 헬스체크 실패 시 unhealthy 반환

---

## 아키텍처 다이어그램

```
                    ┌─────────────────┐
                    │   POST /salt    │
                    │  (salt.route)   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  createProvider │
                    │    (factory)    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ LocalProvider │   │RemoteProvider │   │HybridProvider │
│               │   │               │   │ (Local+Remote)│
│ - env seed    │   │ - HTTP proxy  │   │               │
│ - AWS secrets │   │ - retry       │   │               │
│ - Vault       │   │ - timeout     │   │               │
│ - File        │   │               │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
                             │
                    ┌────────▼────────┐
                    │ RouterProvider  │
                    │ (멀티테넌트)     │
                    │ aud별 라우팅    │
                    └─────────────────┘
```

---

## 요약

| 파일 | 역할 | 핵심 기능 |
|------|------|----------|
| `types/index.ts` | 타입 정의 | 모든 인터페이스의 계약서 |
| `local.provider.ts` | 자체 Salt 생성 | HKDF 기반 결정론적 생성 |
| `remote.provider.ts` | 외부 프록시 | 재시도, 타임아웃 지원 |
| `hybrid.provider.ts` | 장애 대응 | Circuit Breaker 패턴 |
| `router.provider.ts` | 멀티테넌트 | aud 기반 라우팅 |
| `providers/index.ts` | 팩토리 | 동적 Provider 생성 |
| `salt.route.ts` | API | POST /salt 엔드포인트 |
| `salt-providers.ts` | 설정 로더 | 환경변수 → Config |
