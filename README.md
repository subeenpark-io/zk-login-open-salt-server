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

이 프로젝트는 다양한 배포 시나리오를 지원합니다.

### 모드 개요

| 모드 | 설명 | 사용 케이스 |
|------|------|------------|
| **Standalone** | 자체 시드로 독립 운영 | 완전한 제어가 필요한 경우 |
| **Proxy** | 외부 서버(Mysten Labs) 프록시 | 캐싱, Rate limiting 추가 |
| **Hybrid** | Primary + Fallback | 고가용성(HA) 설정 |
| **Router** | 멀티테넌트 라우팅 | 앱별 다른 provider 사용 |

### 상세 설명

#### 1. Standalone (자체 시드)

**당신이 직접 Salt Server와 Master Seed를 소유하고 관리합니다.**

```
User → [당신의 Salt Server] → Salt 생성 (당신의 seed)
```

**특징:**
- ✅ 완전한 제어권과 독립성
- ✅ 외부 의존성 없음
- ⚠️ Seed 관리 책임 (분실 시 모든 사용자 주소 변경)

**시드 저장 방식 (보안 수준 순):**

| 저장 방식 | 보안 수준 | 설명 |
|----------|----------|------|
| 환경변수 (`MASTER_SEED`) | ⭐ | 가장 간단, 테스트/개발용 |
| 파일 (`seed.json`) | ⭐⭐ | 파일 시스템에 저장 |
| **AWS Secrets Manager** | ⭐⭐⭐ | AWS 관리형 시크릿 저장소 |
| HashiCorp Vault | ⭐⭐⭐ | Enterprise 시크릿 관리 |
| **AWS Nitro Enclaves** | ⭐⭐⭐⭐⭐ | TEE 격리 환경 (최고 보안) |

> **중요**: AWS Secrets Manager와 Nitro Enclaves는 **Standalone 모드의 일부**입니다. 둘 다 당신의 seed를 더 안전하게 저장하는 방법일 뿐, Mysten Labs와는 무관합니다.

#### 2. Proxy (외부 서버 프록시)

**Mysten Labs의 Salt Server를 백엔드로 사용합니다.**

```
User → [당신의 Proxy Server] → [Mysten Labs] → Salt 생성 (Mysten의 seed)
```

**특징:**
- ✅ Seed 관리 책임 없음
- ✅ 캐싱, Rate limiting 등 부가 기능 추가 가능
- ⚠️ Mysten Labs 서비스에 의존

**사용 예:**
- Mysten Labs의 인프라를 신뢰하는 경우
- 빠르게 시작하고 싶을 때
- 자체 Seed 관리 부담을 피하고 싶을 때

#### 3. Hybrid (Primary + Fallback)

**자체 시드를 Primary로 사용하고, 장애 시 Mysten Labs로 Fallback.**

```
User → [당신의 Server]
         ├─ Primary: 자체 시드 (정상)
         └─ Fallback: Mysten Labs (장애 시)
```

**특징:**
- ✅ 고가용성 (HA) 보장
- ✅ Primary 장애 시 자동 전환
- ⚠️ 두 시드가 다르면 사용자 주소가 달라짐

#### 4. Router (멀티테넌트)

**앱/고객별로 다른 Salt Provider 사용.**

```
Client (App A) → [Salt Router] → Provider A (자체 시드)
Client (App B) → [Salt Router] → Provider B (Mysten Labs)
Client (App C) → [Salt Router] → Provider C (커스텀 서버)
```

**특징:**
- ✅ B2B SaaS에서 고객별 격리
- ✅ JWT의 `aud` 필드로 자동 라우팅
- ⚠️ 복잡한 설정 필요

---

### 통합 방식 (SDK)

위 배포 모드와 별개로, **기존 서버에 Salt 기능만 추가**할 수 있습니다.

```
User → [당신의 기존 Express 서버]
         ├─ /api/users (기존 API)
         ├─ /api/posts (기존 API)
         └─ /zklogin/salt (새로 추가된 Salt API)
```

**사용 케이스:**
- 이미 운영 중인 백엔드가 있을 때
- 독립 서버가 아닌 기능만 추가하고 싶을 때
- Express, Fastify 등 기존 프레임워크에 통합

SDK를 통해 어떤 배포 모드(Standalone, Proxy 등)든 선택해서 사용할 수 있습니다.

## 빠른 시작

### 전제 조건

```bash
# 의존성 설치
npm install

# TypeScript 빌드 (프로덕션용)
npm run build

# 또는 개발 모드로 바로 실행 (빌드 불필요, Hot Reload 지원)
npm run dev
```

### 1. YAML 설정 파일 사용 (권장)

```bash
# 설정 파일 복사
cp config.example.yaml config.yaml

# config.yaml 수정 (seed 설정 등)
# 그리고 실행
npm start
```

### 2. Standalone (자체 시드)

```bash
# 1. 시드 생성
npm run generate-seed

# 출력 예시:
# ========================================
# Generated Master Seed (32 bytes):
# 0x7a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b
# ========================================

# 2. 생성된 시드로 실행
export MASTER_SEED="0x7a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b"
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
app.use(express.json());
app.use('/zklogin', await createSaltRouter({
  provider: { type: 'mysten' }
}));
// POST /zklogin/salt 엔드포인트 사용 가능
```

### 6. Fastify 통합

```typescript
import Fastify from 'fastify';
import { saltPlugin } from 'zklogin-salt-server/sdk/integrations/fastify';

const fastify = Fastify();
await fastify.register(saltPlugin, {
  provider: { type: 'mysten' },
  prefix: '/zklogin'  // optional
});
// POST /zklogin/salt 엔드포인트 사용 가능
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

**Error Response (400/401):**
```json
{
  "error": "invalid_jwt",
  "message": "JWT signature verification failed"
}
```

### `GET /health`

기본 헬스체크 엔드포인트입니다.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### `GET /ready`

서비스 준비 상태를 확인합니다 (Kubernetes readiness probe용).

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "providers": {
    "local": {
      "healthy": true,
      "message": "Provider is healthy"
    }
  }
}
```

## 배포 가이드

### 로컬 개발 (Docker)

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

---

## 프로덕션 배포 가이드

프로덕션 환경에서는 두 가지 배포 방식을 지원합니다:

| 방식 | 보안 수준 | 복잡도 | 추천 |
|------|----------|--------|------|
| **AWS Secrets Manager + ECS** | 높음 | 낮음 | 대부분의 경우 |
| **AWS Nitro Enclaves** | 최고 | 높음 | 최고 수준 보안 필요 시 |

---

### 방법 1: AWS Secrets Manager + ECS Fargate

#### 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                      AWS Cloud                               │
│                                                              │
│  Client → ALB (HTTPS) → ECS Fargate → Secrets Manager       │
│                              │                               │
│                              └─→ 시드 로드 (시작 시 1회)     │
└─────────────────────────────────────────────────────────────┘
```

#### Step 1: 마스터 시드 생성

```bash
npm run generate-seed

# 출력 예시:
# ========================================
# Generated Master Seed (32 bytes):
# 0x7a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b
# ========================================
```

> ⚠️ **중요**: 이 시드를 안전한 곳에 백업하세요. 분실 시 모든 사용자의 zkLogin 주소가 변경됩니다.

#### Step 2: AWS Secrets Manager에 시드 저장

```bash
# AWS CLI로 시크릿 생성
aws secretsmanager create-secret \
  --name zklogin/master-seed \
  --description "zkLogin Salt Server Master Seed" \
  --secret-string '{"masterSeed": "0x<생성된-64자-hex-시드>"}' \
  --region us-west-2
```

#### Step 3: ECR에 Docker 이미지 푸시

```bash
# 변수 설정
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-west-2

# ECR 로그인
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# ECR 리포지토리 생성
aws ecr create-repository \
  --repository-name zklogin-salt-server \
  --region $AWS_REGION

# 이미지 빌드 및 푸시
docker build -t zklogin-salt-server .
docker tag zklogin-salt-server:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/zklogin-salt-server:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/zklogin-salt-server:latest
```

#### Step 4: Terraform으로 인프라 배포

```bash
cd deploy/terraform

# 변수 파일 생성
cat > terraform.tfvars << EOF
aws_region  = "us-west-2"
environment = "prod"

# ECR 이미지 URL (Step 3에서 푸시한 이미지)
container_image = "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/zklogin-salt-server:latest"

# Secrets Manager 시크릿 이름 (Step 2에서 생성)
master_seed_secret_name = "zklogin/master-seed"

# 도메인 설정 (선택사항)
# domain_name         = "salt.example.com"
# acm_certificate_arn = "arn:aws:acm:us-west-2:..."

# 보안 설정
cors_origins   = "https://your-app.com"
rate_limit_max = 100
EOF

# Terraform 실행
terraform init
terraform plan
terraform apply
```

#### Step 5: 배포 확인

```bash
# ALB URL 확인
export SALT_URL=$(terraform output -raw salt_server_url)
echo "Salt Server URL: $SALT_URL"

# 헬스체크
curl $SALT_URL/health

# Salt 요청 테스트 (유효한 JWT 필요)
curl -X POST $SALT_URL/v1/salt \
  -H "Content-Type: application/json" \
  -d '{"jwt": "<유효한-Google/Facebook-JWT>"}'
```

#### 서버 설정 (자동 적용됨)

Terraform 배포 시 다음 설정이 자동으로 적용됩니다:

```yaml
# ECS Task에서 사용되는 설정
provider:
  type: local
  seed:
    type: aws
    secretName: "zklogin/master-seed"
    region: "us-west-2"
    secretKey: "masterSeed"
```

---

### 방법 2: AWS Nitro Enclaves (최고 보안)

Nitro Enclaves는 **완전히 구현**되어 있습니다. TEE(Trusted Execution Environment)를 사용하여 마스터 시드를 보호합니다.

#### 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    EC2 (Nitro-enabled)                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Parent Instance                                            │ │
│  │  ┌────────────────────────────┐                            │ │
│  │  │  Salt Server (Node.js)     │                            │ │
│  │  │  - API 요청 수신           │←── ALB ←── Client          │ │
│  │  │  - JWT 검증                │                            │ │
│  │  │  - vsock으로 salt 요청     │                            │ │
│  │  └─────────────┬──────────────┘                            │ │
│  │                │ vsock (CID: 16, Port: 5000)               │ │
│  └────────────────┼───────────────────────────────────────────┘ │
│                   │                                              │
│  ┌────────────────▼───────────────────────────────────────────┐ │
│  │  Nitro Enclave (격리된 TEE 환경)                            │ │
│  │  ┌────────────────────────────┐                            │ │
│  │  │  Enclave App               │                            │ │
│  │  │  - KMS로 시드 복호화       │←── AWS KMS (attestation)   │ │
│  │  │  - HKDF로 salt 계산        │                            │ │
│  │  │  - salt만 반환 (시드 노출 X)│                            │ │
│  │  └────────────────────────────┘                            │ │
│  │  ⚡ 메모리 암호화, 네트워크 완전 격리                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

#### Secrets Manager vs Nitro Enclaves 비교

| 특징 | Secrets Manager | Nitro Enclaves |
|------|-----------------|----------------|
| 시드 저장 위치 | AWS 관리 저장소 | Enclave 메모리 (암호화) |
| 런타임 시드 노출 | 앱 메모리에 로드됨 | Enclave 외부 노출 불가 |
| AWS 운영자 접근 | 이론적으로 가능 | **불가능** (TEE) |
| 설정 복잡도 | 낮음 | 중간 |
| 비용 | ECS Fargate 요금 | EC2 + Enclave 요금 |

#### Step 1: Enclave 이미지(EIF) 빌드

```bash
cd enclave

# 의존성 설치
npm install

# Docker 이미지 및 EIF 빌드
./build-eif.sh

# 출력 예시:
# PCR0: e4d...abc (이 값을 Step 3에서 사용)
```

> **중요**: PCR0 값을 메모해두세요. KMS 정책에 사용됩니다.

#### Step 2: 마스터 시드 생성 및 KMS로 암호화

```bash
# 시드 생성
npm run generate-seed

# KMS로 암호화 (Step 4에서 생성되는 KMS 키 사용)
aws kms encrypt \
  --key-id alias/zklogin-prod-enclave-seed \
  --plaintext fileb://<(echo -n "0x<생성된-시드>") \
  --output text --query CiphertextBlob > encrypted-seed.b64

# 암호화된 시드를 환경변수로 사용할 예정
export ENCRYPTED_SEED=$(cat encrypted-seed.b64)
```

#### Step 3: Terraform 변수 설정

```bash
cd deploy/aws-nitro/terraform
cp terraform.tfvars.example terraform.tfvars

# terraform.tfvars 수정
cat > terraform.tfvars << EOF
aws_region  = "us-west-2"
environment = "prod"

# EC2 설정 (Nitro 지원 인스턴스)
instance_type = "c5.xlarge"

# Enclave 리소스
enclave_cpu_count = 2
enclave_memory_mb = 512

# PCR0 값 (Step 1에서 확인)
enclave_pcr0 = "<your-pcr0-value>"

# 도메인 설정 (선택사항)
# domain_name         = "salt.example.com"
# acm_certificate_arn = "arn:aws:acm:..."

# 보안 설정
allowed_cidr_blocks = ["0.0.0.0/0"]
EOF
```

#### Step 4: Terraform으로 인프라 배포

```bash
terraform init
terraform plan
terraform apply
```

배포되는 리소스:
- VPC, 서브넷, 보안 그룹
- EC2 인스턴스 (Nitro Enclaves 활성화)
- Application Load Balancer
- **KMS 키 (attestation 정책 포함)**
- IAM 역할 및 정책
- CloudWatch 로그 그룹

#### Step 5: EC2 인스턴스 설정

```bash
# SSM으로 인스턴스 접속
aws ssm start-session --target <instance-id>

# 애플리케이션 코드 업로드
scp -r dist/ ec2-user@<instance>:/opt/zklogin/

# Enclave 이미지 업로드
scp enclave/zklogin-enclave.eif ec2-user@<instance>:/opt/zklogin/enclave/

# 환경변수 설정 (암호화된 시드)
sudo bash -c 'echo "ENCRYPTED_SEED=<base64-encrypted-seed>" >> /opt/zklogin/.env'
```

#### Step 6: Enclave 시작

```bash
# Enclave 시작
/opt/zklogin/manage-enclave.sh start

# 상태 확인
/opt/zklogin/manage-enclave.sh status

# Salt Server 시작
sudo systemctl enable --now zklogin-salt
```

#### Step 7: 테스트

```bash
# ALB URL 확인
export SALT_URL=$(terraform output -raw salt_server_url)

# 헬스체크
curl $SALT_URL/health

# Salt 요청 테스트
curl -X POST $SALT_URL/v1/salt \
  -H "Content-Type: application/json" \
  -d '{"jwt": "<유효한-JWT>"}'
```

#### 구현된 컴포넌트

| 컴포넌트 | 파일 | 설명 |
|---------|------|------|
| vsock 클라이언트 | `src/providers/nitro/vsock-client.ts` | Parent → Enclave 통신 |
| LocalProvider | `src/providers/local.provider.ts` | Nitro 모드 지원 |
| Enclave vsock 서버 | `enclave/src/vsock-server.ts` | JSON-RPC 서버 |
| KMS 클라이언트 | `enclave/src/kms-client.ts` | Attestation 복호화 |
| Salt 서비스 | `enclave/src/salt-service.ts` | HKDF salt 계산 |
| EIF 빌드 스크립트 | `enclave/build-eif.sh` | Enclave 이미지 생성 |
| Terraform | `deploy/aws-nitro/terraform/` | 인프라 자동화 |

#### Salt Server 설정

```yaml
# config.yaml
provider:
  type: local
  seed:
    type: nitro
    enclaveCid: 16      # Enclave Context ID
    port: 5000          # vsock 포트
    timeout: 5000       # 타임아웃 (ms)
```

#### 보안 특징

- **메모리 암호화**: 시드가 암호화된 메모리에만 존재
- **KMS Attestation**: 특정 Enclave 이미지에서만 복호화 가능
- **네트워크 격리**: Enclave는 vsock 외 네트워크 접근 불가
- **AWS 운영자 접근 불가**: TEE 환경으로 완전 격리

---

### 배포 방식 선택 가이드

| 상황 | 추천 방식 |
|------|----------|
| 일반적인 프로덕션 배포 | **Secrets Manager + ECS** |
| 규제 준수 필요 (금융, 의료) | Nitro Enclaves |
| AWS 운영자 접근 차단 필요 | Nitro Enclaves |
| 빠른 배포 필요 | **Secrets Manager + ECS** |
| 개발/테스트 환경 | Docker Compose |

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

#### 6. AWS Nitro Enclaves (최고 보안)

TEE(Trusted Execution Environment)를 사용한 최고 수준의 보안:

```yaml
provider:
  type: local
  seed:
    type: nitro
    enclaveCid: 16      # Enclave Context ID
    port: 5000          # vsock 포트
    timeout: 5000       # 타임아웃 (ms)
```

Nitro Enclaves의 장점:
- 메모리 암호화 (AWS 운영자도 접근 불가)
- KMS attestation (신뢰할 수 있는 환경에서만 시드 복호화)
- 네트워크 격리 (vsock만 허용)

Nitro Enclaves 전체 구현이 포함되어 있습니다.
자세한 배포 방법은 [프로덕션 배포 가이드 - 방법 2](#방법-2-aws-nitro-enclaves-최고-보안)를 참조하세요.

### 환경 변수

YAML 설정 파일이 없는 경우 환경 변수로 설정할 수 있습니다:

#### 공통 설정

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `CONFIG_FILE` | No | - | YAML 설정 파일 경로 |
| `SALT_PROVIDER_MODE` | No | local | Provider 모드: local, remote, hybrid, router |
| `PORT` | No | 3000 | 서버 포트 |
| `LOG_LEVEL` | No | info | 로그 레벨 |
| `RATE_LIMIT_MAX` | No | 100 | 분당 최대 요청 수 |
| `CORS_ORIGINS` | No | * | 허용된 CORS 오리진 |

#### Local Provider (SALT_PROVIDER_MODE=local)

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `SEED_SOURCE` | No | env | 시드 소스: env, aws, vault, file, nitro |
| `MASTER_SEED` | * | - | Hex 인코딩된 마스터 시드 (SEED_SOURCE=env) |
| `AWS_SECRET_NAME` | * | - | AWS Secrets Manager 시크릿 이름 (SEED_SOURCE=aws) |
| `AWS_REGION` | No | us-west-2 | AWS 리전 (SEED_SOURCE=aws) |
| `VAULT_ADDR` | * | - | HashiCorp Vault 주소 (SEED_SOURCE=vault) |
| `VAULT_PATH` | * | - | Vault 시크릿 경로 (SEED_SOURCE=vault) |
| `VAULT_TOKEN` | * | - | Vault 인증 토큰 (SEED_SOURCE=vault) |
| `SEED_FILE_PATH` | * | - | 시드 파일 경로 (SEED_SOURCE=file) |

#### Remote Provider (SALT_PROVIDER_MODE=remote)

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `REMOTE_SALT_ENDPOINT` | Yes | - | 원격 Salt Server URL |
| `REMOTE_SALT_TIMEOUT` | No | 10000 | 요청 타임아웃 (ms) |
| `REMOTE_SALT_API_KEY` | No | - | API 키 (필요시) |
| `REMOTE_SALT_RETRY_COUNT` | No | 0 | 재시도 횟수 |

#### Hybrid Provider (SALT_PROVIDER_MODE=hybrid)

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `HYBRID_FALLBACK_ENABLED` | No | true | Fallback 활성화 여부 |
| `HYBRID_FALLBACK_ENDPOINT` | No | Mysten Labs | Fallback 서버 URL |
| `HYBRID_FALLBACK_AFTER_SECONDS` | No | 60 | Primary 재시도 대기 시간 (초) |
| `HYBRID_FALLBACK_RETRY_COUNT` | No | 0 | Fallback 재시도 횟수 |

+ Local Provider 변수들 (Primary로 사용)

#### Router Provider (SALT_PROVIDER_MODE=router)

| 변수 | 필수 | 설명 |
|------|------|------|
| `ROUTER_CONFIG_JSON` | * | JSON 형식 라우터 설정 |
| `ROUTER_CONFIG_PATH` | * | 라우터 설정 파일 경로 |

\* 중 하나 필수

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

새로운 제공자 추가는 [src/config/oauth-providers.ts](src/config/oauth-providers.ts)를 참조하세요.

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
