# zkLogin Salt Server

개발자들이 쉽게 배포할 수 있는 zkLogin Salt Server 오픈소스 구현체.

## 프로젝트 개요

### 목적
Sui zkLogin을 사용하는 앱 개발자들이 쉽게 자체 Salt Server를 운영할 수 있도록 하는 것.
다양한 배포 모드와 기존 인프라 통합을 지원합니다.

### Salt Server 역할
1. **Salt 생성**: Master Seed + JWT를 사용해 결정론적(deterministic) salt 값 생성
2. **프라이버시 보장**: Web2 credentials와 Sui 주소 간 연결을 암호학적으로 분리
3. **JWT 검증**: OAuth 제공자(Google, Facebook 등)의 JWT 유효성 검증

### 핵심 보안 원칙
- Master Seed는 절대 평문으로 로그/노출되면 안 됨
- 가능하면 TEE(Trusted Execution Environment) 사용 권장
- Seed 복구 메커니즘 (Shamir's Secret Sharing) 필수

## 배포 모드

이 프로젝트는 **4가지 배포 모드**를 지원합니다:

### 1. Standalone Mode (독립 실행)
자체 시드로 salt를 생성하는 완전 독립적인 서버.

```
Client → [Salt Server] → Salt 생성 (자체 시드)
```

### 2. Proxy Mode (프록시)
기존 Salt Server(예: Mysten Labs) 앞에서 프록시로 동작.
캐싱, rate limiting, 로깅 추가 가능.

```
Client → [Salt Proxy] → [Mysten Labs Salt Server]
```

### 3. Hybrid Mode (하이브리드)
Primary는 자체 서버, Fallback은 외부 서버.

```
Client → [Salt Server] → Primary: 자체 시드
                       → Fallback: Mysten Labs (장애 시)
```

### 4. Multi-tenant Mode (멀티테넌트)
앱/고객별로 다른 salt provider 사용.

```
Client (App A) → [Salt Server] → Provider A (자체 시드)
Client (App B) → [Salt Server] → Provider B (Mysten Labs)
Client (App C) → [Salt Server] → Provider C (커스텀 서버)
```

## 아키텍처

### 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Apps                                    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ POST /v1/salt
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        zkLogin Salt Server                               │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      Salt Provider Router                          │ │
│  │   (JWT 검증 → Provider 선택 → Salt 요청 → 응답)                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│         │                    │                    │                     │
│         ▼                    ▼                    ▼                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│  │   Local     │     │   Remote    │     │   Custom    │               │
│  │  Provider   │     │  Provider   │     │  Provider   │               │
│  │ (자체 시드)  │     │(외부 서버)   │     │ (플러그인)   │               │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘               │
└─────────┼───────────────────┼───────────────────┼───────────────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
   ┌────────────┐     ┌────────────────┐   ┌────────────────┐
   │  Secrets   │     │  Mysten Labs   │   │  Your Backend  │
   │  Manager   │     │  Salt Server   │   │    Server      │
   └────────────┘     └────────────────┘   └────────────────┘
```

### Provider 인터페이스

```typescript
interface SaltProvider {
  name: string;
  
  // Salt 생성/조회
  getSalt(sub: string, aud: string): Promise<string>;
  
  // Provider 상태 확인
  healthCheck(): Promise<boolean>;
  
  // 정리 (시드 메모리 해제 등)
  destroy(): Promise<void>;
}
```

## 디렉토리 구조

```
zklogin-salt-server/
├── CLAUDE.md                 # 이 파일
├── README.md                 # 사용자 문서
├── package.json
├── tsconfig.json
├── docker-compose.yml        # 로컬 개발용
├── Dockerfile
├── src/
│   ├── main.ts              # 앱 진입점
│   ├── config/
│   │   ├── index.ts         # 설정 로더
│   │   ├── oauth-providers.ts  # OAuth 제공자 설정
│   │   └── salt-providers.ts   # Salt Provider 설정
│   ├── providers/           # Salt Provider 구현체들
│   │   ├── index.ts         # Provider 인터페이스 & 팩토리
│   │   ├── local.provider.ts    # 자체 시드 사용
│   │   ├── remote.provider.ts   # 외부 서버 프록시
│   │   ├── hybrid.provider.ts   # Primary + Fallback
│   │   └── router.provider.ts   # 멀티테넌트 라우팅
│   ├── services/
│   │   ├── jwt.service.ts   # JWT 검증
│   │   ├── seed.service.ts  # 시드 관리
│   │   └── cache.service.ts # Salt 캐싱 (선택)
│   ├── routes/
│   │   ├── index.ts         # 라우터 설정
│   │   ├── salt.route.ts    # Salt API 엔드포인트
│   │   ├── health.route.ts  # 헬스체크
│   │   └── admin.route.ts   # 관리 API (선택)
│   ├── middleware/
│   │   ├── rate-limit.ts    # Rate limiting
│   │   ├── error-handler.ts # 에러 핸들링
│   │   └── tenant.ts        # 멀티테넌트 식별
│   └── utils/
│       ├── crypto.ts        # 암호화 유틸
│       └── logger.ts        # 로깅 (민감정보 제외)
├── sdk/                     # 라이브러리/SDK
│   ├── core/               # 핵심 로직 (프레임워크 무관)
│   │   ├── index.ts
│   │   └── salt-client.ts
│   └── integrations/       # 프레임워크 통합
│       ├── express.ts      # Express 미들웨어
│       ├── fastify.ts      # Fastify 플러그인
│       └── hono.ts         # Hono 미들웨어
├── deploy/
│   ├── docker/
│   ├── kubernetes/
│   └── aws-nitro/
├── scripts/
│   ├── generate-seed.ts
│   ├── shard-seed.ts
│   └── recover-seed.ts
└── examples/
    ├── standalone/         # 독립 실행 예제
    ├── proxy/              # 프록시 모드 예제
    ├── hybrid/             # 하이브리드 예제
    └── express-integration/ # Express 통합 예제
```

## 기술 스택

- **Runtime**: Node.js 20+ / Bun
- **Language**: TypeScript
- **Framework**: Hono (경량, Edge 호환)
- **Crypto**: @noble/hashes (HKDF), jose (JWT)
- **Secret Sharing**: shamir npm 패키지
- **배포**: Docker, Kubernetes, AWS Nitro Enclaves

## 핵심 구현 세부사항

### Salt 생성 알고리즘

```typescript
// src/services/salt.service.ts
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

export function deriveSalt(
  masterSeed: Uint8Array,
  sub: string,      // JWT subject (사용자 ID)
  aud: string       // JWT audience (앱 ID)
): Uint8Array {
  const info = new TextEncoder().encode(`${sub}:${aud}`);
  return hkdf(sha256, masterSeed, /*salt=*/undefined, info, 32);
}
```

### 지원 OAuth Providers

| Provider | JWKS URL |
|----------|----------|
| Google | https://www.googleapis.com/oauth2/v3/certs |
| Facebook | https://www.facebook.com/.well-known/oauth/openid/jwks/ |
| Apple | https://appleid.apple.com/auth/keys |
| Twitch | https://id.twitch.tv/oauth2/keys |

### API 스펙

#### `POST /v1/salt`

Request:
```json
{
  "jwt": "eyJhbGciOiJSUzI1NiIs..."
}
```

Response (200):
```json
{
  "salt": "0x1234567890abcdef..."
}
```

Error Response (400/401):
```json
{
  "error": "invalid_jwt",
  "message": "JWT signature verification failed"
}
```

## 환경 변수

### 공통

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `SALT_PROVIDER_MODE` | No | local | Provider 모드: local, remote, hybrid, router |
| `PORT` | No | 3000 | 서버 포트 |
| `LOG_LEVEL` | No | info | 로그 레벨 |
| `RATE_LIMIT_MAX` | No | 100 | 분당 최대 요청 수 |
| `CORS_ORIGINS` | No | * | 허용된 CORS 오리진 |

### Local Provider

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `SEED_SOURCE` | No | env | 시드 소스: env, aws, vault |
| `MASTER_SEED` | * | - | Hex 인코딩된 마스터 시드 |
| `AWS_SECRET_NAME` | * | - | AWS Secrets Manager 시크릿 이름 |
| `AWS_REGION` | No | us-west-2 | AWS 리전 |
| `VAULT_ADDR` | * | - | HashiCorp Vault 주소 |
| `VAULT_PATH` | * | - | Vault 시크릿 경로 |

### Remote Provider

| 변수 | 필수 | 설명 |
|------|------|------|
| `REMOTE_SALT_ENDPOINT` | Yes | 원격 Salt Server URL |
| `REMOTE_SALT_TIMEOUT` | No | 요청 타임아웃 (ms, 기본: 10000) |
| `REMOTE_SALT_API_KEY` | No | API 키 (필요시) |

### Hybrid Provider

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `HYBRID_FALLBACK_ENABLED` | No | true | Fallback 활성화 |
| `HYBRID_FALLBACK_ENDPOINT` | No | Mysten Labs | Fallback 서버 URL |
| `HYBRID_FALLBACK_AFTER_SECONDS` | No | 60 | Primary 재시도 대기 시간 |

### Router Provider

| 변수 | 필수 | 설명 |
|------|------|------|
| `ROUTER_CONFIG_JSON` | * | JSON 형식 라우터 설정 |
| `ROUTER_CONFIG_PATH` | * | 라우터 설정 파일 경로 |

## 사용 예제

### 1. 자체 시드로 독립 실행 (Standalone)

```bash
export SALT_PROVIDER_MODE=local
export MASTER_SEED="your-hex-seed"
npm start
```

### 2. Mysten Labs 프록시 (Proxy)

```bash
export SALT_PROVIDER_MODE=remote
export REMOTE_SALT_ENDPOINT="https://salt.api.mystenlabs.com/get_salt"
npm start
```

### 3. 하이브리드 (자체 + Mysten 백업)

```bash
export SALT_PROVIDER_MODE=hybrid
export SEED_SOURCE=aws
export AWS_SECRET_NAME="zklogin/prod-seed"
export HYBRID_FALLBACK_ENABLED=true
npm start
```

### 4. 멀티테넌트 라우팅

```bash
export SALT_PROVIDER_MODE=router
export ROUTER_CONFIG_JSON='{
  "type": "router",
  "defaultProvider": "mysten",
  "providers": {
    "local": {"type": "local", "seedSource": "env"},
    "mysten": {"type": "remote", "endpoint": "https://salt.api.mystenlabs.com/get_salt"}
  },
  "routes": [
    {"name": "internal", "match": {"audience": "*.mycompany.com"}, "provider": "local"}
  ]
}'
npm start
```

### 5. 기존 Express 서버에 통합

```typescript
import express from 'express';
import { createSaltRouter } from 'zklogin-salt-server/sdk/integrations/express';

const app = express();

// 기존 라우트들
app.get('/api/users', ...);

// zkLogin salt 엔드포인트 추가
app.use('/zklogin', createSaltRouter({
  provider: { type: 'mysten' }
}));

app.listen(3000);
```

### 6. 라이브러리로 직접 사용

```typescript
import { SaltClient } from 'zklogin-salt-server/sdk/core';

// Mysten Labs 사용
const client = SaltClient.mysten();
const { salt } = await client.getSalt(jwt);

// 또는 자체 시드
const localClient = SaltClient.local({ seed: 'your-hex-seed' });
const { salt } = await localClient.getSalt(jwt);
```

## 주의사항 (작업 시 참고)

1. **로깅 주의**: Master Seed, Salt 값을 절대 로그에 남기지 않음
2. **JWT 전체 노출 금지**: JWT의 sub/aud만 사용, 전체 토큰 로깅 금지
3. **에러 메시지**: 내부 상태 노출하지 않는 일반적인 에러 메시지 사용
4. **Rate Limiting**: 무차별 대입 공격 방지
5. **CORS**: 프로덕션에서 특정 도메인만 허용

## 참고 자료

- [Sui zkLogin 문서](https://docs.sui.io/concepts/cryptography/zklogin)
- [Mysten Labs Salt Server 아키텍처](https://blog.sui.io/zklogin-salt-server-architecture/)
- [AWS Nitro Enclaves](https://aws.amazon.com/ec2/nitro/nitro-enclaves/)
- [Shamir's Secret Sharing](https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing)
