# zkLogin Salt Server

개발자들이 쉽게 배포할 수 있는 **Sui zkLogin Salt Server** 오픈소스 구현체입니다.

Mysten Labs의 Salt Server 아키텍처를 기반으로 하되, 다양한 환경에서 쉽게 배포할 수 있도록 설계되었습니다.

## 특징

- 🔐 **안전한 Salt 생성**: HKDF 기반 결정론적 salt 유도
- 🌐 **다양한 OAuth 지원**: Google, Facebook, Apple, Twitch, Kakao 등
- 📦 **쉬운 배포**: Docker, Kubernetes, AWS Nitro Enclaves 지원
- 🔑 **유연한 시크릿 관리**: 환경변수, AWS Secrets Manager, HashiCorp Vault, 파일
- 🛡️ **보안 우선 설계**: Rate limiting, 민감정보 로깅 방지, Shamir's Secret Sharing
- 🔄 **다양한 배포 모드**: Standalone, Proxy, Hybrid, Multi-tenant
- 📝 **YAML 설정**: 직관적인 YAML 기반 설정 파일 지원
- 🧩 **SDK 제공**: 기존 서버에 쉽게 통합 가능

## 배포 모드

| 모드 | 설명 | 사용 케이스 |
|------|------|------------|
| **Standalone** | 자체 시드로 독립 운영 | 완전한 제어가 필요한 경우 |
| **Proxy** | 외부 서버(Mysten Labs) 프록시 | 캐싱, Rate limiting 추가 |
| **Hybrid** | Primary + Fallback | 고가용성(HA) 설정 |
| **Router** | 멀티테넌트 라우팅 | 앱별 다른 provider 사용 |

## 빠른 시작

### 1. YAML 설정 파일 사용 (권장)

```bash
# 설정 파일 복사
cp config.example.yaml config.yaml

# 설정 수정 후 실행
npm start
```

### 2. Standalone (자체 시드)

```bash
# 시드 생성
npm run generate-seed

# 실행
export MASTER_SEED="your-generated-seed"
npm start
```

### 3. Proxy (Mysten Labs)

```bash
export SALT_PROVIDER_MODE=remote
export REMOTE_SALT_ENDPOINT="https://salt.api.mystenlabs.com/get_salt"
npm start
```

### 4. 기존 서버에 통합 (SDK)

```typescript
import { SaltClient } from 'zklogin-salt-server/sdk/core';

// Mysten Labs 사용
const client = SaltClient.mysten();
const { salt } = await client.getSalt(jwt);

// 자체 시드 사용
const localClient = SaltClient.local({ seed: 'your-hex-seed' });
const { salt } = await localClient.getSalt(jwt);
```

### 5. Express 통합

```typescript
import express from 'express';
import { createSaltRouter } from 'zklogin-salt-server/sdk/integrations/express';

const app = express();
app.use('/zklogin', createSaltRouter({
  provider: { type: 'mysten' }
}));
```

## API

### `POST /v1/salt`

JWT를 검증하고 salt를 반환합니다.

**Request:**
```json
{
  "jwt": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "salt": "0x1234567890abcdef..."
}
```

### `GET /health/ready`

서비스 준비 상태를 확인합니다 (Kubernetes readiness probe용).

## 배포 가이드

### Docker

```bash
# 이미지 빌드
docker build -t zklogin-salt-server .

# 실행
docker run -d \
  -p 3000:3000 \
  -e MASTER_SEED="your-seed" \
  zklogin-salt-server
```

### Docker Compose

```bash
export MASTER_SEED="your-seed"
docker-compose up -d
```

### Kubernetes

```bash
# 시크릿 생성
kubectl create secret generic zklogin-salt-server-config \
  --from-literal=aws-secret-name=zklogin/production-seed \
  --from-literal=aws-region=us-west-2

# 배포
kubectl apply -f deploy/kubernetes/
```

### AWS Secrets Manager 사용

1. AWS에 시드 저장:
```bash
npm run generate-seed -- --aws --secret-name zklogin/production-seed
```

2. 환경 변수 설정:
```bash
export AWS_SECRET_NAME="zklogin/production-seed"
export AWS_REGION="us-west-2"
```

## 보안 고려사항

### 필수 사항

- ✅ TLS/HTTPS 사용 (프로덕션)
- ✅ 시드를 환경 변수가 아닌 시크릿 매니저에 저장
- ✅ 네트워크 격리 (VPC, 보안 그룹)
- ✅ Rate limiting 활성화

### 권장 사항

- 🔒 AWS Nitro Enclaves 또는 GCP Confidential VM 사용
- 🔒 Shamir's Secret Sharing으로 시드 백업
- 🔒 로그에서 민감 정보 제외 확인
- 🔒 정기적인 보안 감사

### 시드 백업 (Shamir's Secret Sharing)

```bash
# 5개 샤드 생성 (3개로 복구 가능)
npm run shard-seed -- \
  --file seed.json \
  --shares 5 \
  --threshold 3 \
  --output shards/shard
```

## 설정

### YAML 설정 파일 (권장)

`config.yaml` 파일을 통해 모든 설정을 관리할 수 있습니다:

```yaml
# 서버 설정
server:
  port: 3000
  host: "0.0.0.0"

# 로깅 설정
logging:
  level: info  # debug, info, warn, error
  format: json  # json, pretty

# 보안 설정
security:
  corsOrigins: "*"
  rateLimitMax: 100
  rateLimitWindowMs: 60000

# Salt Provider 설정
provider:
  type: local
  seed:
    type: env
    envVar: MASTER_SEED
```

설정 파일 위치 (우선순위 순):
1. `CONFIG_FILE` 환경변수로 지정된 경로
2. `./config.yaml` 또는 `./config.yml`
3. `./salt-server.yaml` 또는 `./salt-server.yml`
4. `/etc/zklogin-salt-server/config.yaml`

### 시드 주입 방식

#### 1. 환경변수 (Environment Variable)

```yaml
provider:
  type: local
  seed:
    type: env
    envVar: MASTER_SEED  # 기본값
```

#### 2. AWS Secrets Manager

```yaml
provider:
  type: local
  seed:
    type: aws
    secretName: "zklogin/production-seed"
    region: "us-west-2"
    secretKey: "masterSeed"  # JSON 시크릿의 키 이름
```

#### 3. HashiCorp Vault

```yaml
provider:
  type: local
  seed:
    type: vault
    address: "https://vault.example.com"
    path: "secret/data/zklogin/seed"
    key: "masterSeed"
    tokenEnvVar: "VAULT_TOKEN"
```

#### 4. 파일

```yaml
provider:
  type: local
  seed:
    type: file
    path: "/run/secrets/master-seed"
    key: "masterSeed"  # JSON 파일인 경우
```

#### 5. 직접 값 (테스트 전용)

```yaml
provider:
  type: local
  seed:
    type: env
    value: "0x1234..."  # 프로덕션에서 사용 금지!
```

### 환경 변수

YAML 설정 파일이 없는 경우 환경 변수로 설정할 수 있습니다:

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `CONFIG_FILE` | No | - | YAML 설정 파일 경로 |
| `MASTER_SEED` | * | - | Hex 인코딩된 마스터 시드 |
| `SEED_SOURCE` | No | env | 시드 소스: env, aws, vault, file |
| `AWS_SECRET_NAME` | * | - | AWS Secrets Manager 시크릿 이름 |
| `AWS_REGION` | No | us-west-2 | AWS 리전 |
| `VAULT_ADDR` | * | - | HashiCorp Vault 주소 |
| `VAULT_PATH` | * | - | Vault 시크릿 경로 |
| `VAULT_TOKEN` | * | - | Vault 인증 토큰 |
| `SEED_FILE_PATH` | * | - | 시드 파일 경로 |
| `PORT` | No | 3000 | 서버 포트 |
| `LOG_LEVEL` | No | info | 로그 레벨 |
| `RATE_LIMIT_MAX` | No | 100 | 분당 최대 요청 수 |
| `CORS_ORIGINS` | No | * | 허용된 CORS 오리진 |

\* 시드 소스에 따라 해당 변수 필수

## 지원 OAuth 제공자

| 제공자 | 상태 |
|--------|------|
| Google | ✅ |
| Facebook | ✅ |
| Apple | ✅ |
| Twitch | ✅ |
| Kakao | ✅ |
| Slack | ✅ |
| Microsoft | ✅ |

새로운 제공자 추가는 `src/config/providers.ts`를 참조하세요.

## 개발

```bash
# 개발 서버 (hot reload)
npm run dev

# 타입 체크
npm run typecheck

# 린트
npm run lint

# 테스트
npm run test
```

## 라이선스

Apache-2.0

## 참고 자료

- [Sui zkLogin 문서](https://docs.sui.io/concepts/cryptography/zklogin)
- [Mysten Labs Salt Server 아키텍처](https://blog.sui.io/zklogin-salt-server-architecture/)
- [AWS Nitro Enclaves](https://aws.amazon.com/ec2/nitro/nitro-enclaves/)
