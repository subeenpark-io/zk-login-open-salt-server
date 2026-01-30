# zkLogin Salt Server 가이드

Salt Server를 다양한 모드로 운영하는 방법에 대한 완전한 가이드입니다.

## 📋 목차

- [배포 모드 개요](#배포-모드-개요)
- [빠른 시작](#빠른-시작)
- [앱 통합 가이드](#앱-통합-가이드)
- [모드별 상세 가이드](#모드별-상세-가이드)
- [비교표](#비교표)
- [선택 가이드](#선택-가이드)

---

## 배포 모드 개요

Salt Server는 4가지 배포 모드를 지원합니다:

| 모드 | 설명 | 사용 사례 |
|------|------|----------|
| **[Standalone](standalone/)** | 자체 seed로 독립 운영 | 완전한 프라이버시, 독립 운영 |
| **[Proxy](proxy/)** | 외부 서버 프록시 | 캐싱, Rate limiting 추가 |
| **[Hybrid](hybrid/)** | Primary + Fallback | 고가용성(HA) 구현 |
| **[Router](router/)** | 멀티테넌트 라우팅 | SaaS 플랫폼, 앱별 분리 |

---

## 빠른 시작

### 1. Standalone 모드 (가장 간단)

완전 독립적인 Salt Server를 로컬에서 실행:

```bash
# 환경변수 방식
cd guides/standalone/01-env
cp .env.example .env
# .env 편집: MASTER_SEED 설정
./test.sh
```

**권장**: 로컬 개발 및 테스트

### 2. Proxy 모드 (Mysten Labs 프록시)

Mysten Labs를 프록시하면서 캐싱/로깅 추가:

```bash
cd guides/proxy
./run-dev.sh
```

**권장**: 점진적 마이그레이션

### 3. Hybrid 모드 (고가용성)

자체 seed를 Primary로, Mysten Labs를 Fallback으로:

```bash
cd guides/hybrid
# .env 생성 및 MASTER_SEED 설정
./run-dev.sh
```

**권장**: 프로덕션 고가용성

### 4. Router 모드 (멀티테넌트)

앱별로 다른 provider 사용:

```bash
cd guides/router
# .env 생성 및 여러 SEED 설정
./run-dev.sh
```

**권장**: SaaS 플랫폼, 멀티 앱

---

## 앱 통합 가이드

실제 앱에서 Salt Server를 통합하는 방법:

### 🔗 [통합 가이드 보기](../sdk/integration-guide/)

완전한 zkLogin 플로우 구현 방법을 배울 수 있습니다:

**포함 내용**:
- ✅ **완전한 zkLogin 플로우**: OAuth → Salt → 주소 계산 → ZK Proof → 트랜잭션
- ✅ **백엔드 통합**: Express, Fastify, Hono 프레임워크 통합 방법
- ✅ **프론트엔드 통합**: React, Vue 예제 코드
- ✅ **실전 예제**: Express + React 완전한 앱 예제
- ✅ **프로덕션 체크리스트**: 보안, 성능, 테스트 가이드

**SDK 사용 예시**:

```typescript
// Express 백엔드
import { createSaltRouter } from 'zklogin-salt-server/sdk/integrations/express';

app.use('/api/zklogin', await createSaltRouter({
  provider: { type: 'mysten' }
}));

// React 프론트엔드
const { salt } = await getSalt(jwt, 'http://localhost:3000/api/zklogin/salt');
const address = await jwtToAddress(jwt, salt);
```

**[👉 전체 통합 가이드 보기](../sdk/integration-guide/README.md)**

---

## 모드별 상세 가이드

### Standalone 모드

완전히 독립적으로 Salt를 생성합니다.

```
Client → [Salt Server] → Salt 생성 (자체 seed)
```

**하위 가이드**:
- [01-env](standalone/01-env/): 환경변수로 seed 관리
- [02-file](standalone/02-file/): 파일로 seed 관리
- [03-aws-secrets](standalone/03-aws-secrets/): AWS Secrets Manager
- [04-vault](standalone/04-vault/): HashiCorp Vault
- [05-nitro](standalone/05-nitro/): AWS Nitro Enclaves (최고 보안)

**설정 예시**:
```yaml
provider:
  type: local
  seed:
    type: env
    envVar: MASTER_SEED
```

**장점**:
- ✅ 완전한 프라이버시
- ✅ 외부 의존성 없음
- ✅ 빠른 응답 속도

**단점**:
- ❌ Seed 관리 책임
- ❌ Seed 유실 시 복구 불가능
- ❌ Fallback 없음

**자세히 보기**: [Standalone 가이드](standalone/)

---

### Proxy 모드

외부 Salt Server (Mysten Labs)를 프록시합니다.

```
Client → [Salt Server (Proxy)] → [Mysten Labs]
          ↓
       캐싱, Rate Limiting, 로깅
```

**설정 예시**:
```yaml
provider:
  type: remote
  endpoint: "https://salt.api.mystenlabs.com/get_salt"
  timeout: 10000
  retryCount: 2
```

**장점**:
- ✅ Mysten Labs 인프라 활용
- ✅ 캐싱으로 응답 속도 개선
- ✅ Rate limiting으로 비용 절감
- ✅ 로깅 및 모니터링 추가

**단점**:
- ❌ Mysten Labs 의존성
- ❌ 프라이버시 제한
- ❌ Mysten Labs 다운 시 서비스 중단

**사용 사례**:
- 초기 개발 단계
- Mysten Labs에서 자체 seed로 마이그레이션 준비
- 로깅/모니터링 추가 필요

**자세히 보기**: [Proxy 가이드](proxy/)

---

### Hybrid 모드

Primary provider와 Fallback provider를 결합합니다.

```
Client → [Salt Server (Hybrid)]
         ├─ Primary: Local (자체 seed)
         │  └─ 실패 시 ↓
         └─ Fallback: Mysten Labs
```

**설정 예시**:
```yaml
provider:
  type: hybrid

  primary:
    type: local
    seed:
      type: env
      envVar: MASTER_SEED

  fallback:
    type: remote
    endpoint: "https://salt.api.mystenlabs.com/get_salt"

  fallbackEnabled: true
  fallbackAfterSeconds: 60
```

**장점**:
- ✅ 고가용성 (99.9%+)
- ✅ Primary 실패 시 자동 Fallback
- ✅ 자동 복구 메커니즘
- ✅ 정상 시에는 자체 seed 사용

**단점**:
- ❌ 복잡한 설정
- ❌ 두 provider 관리 필요
- ❌ Fallback도 다운되면 서비스 중단

**동작 시나리오**:
1. **정상 상태**: Primary (자체 seed) 사용
2. **Primary 실패**: 자동으로 Fallback (Mysten Labs) 전환
3. **Fallback 사용 중**: 60초 동안 Fallback 사용
4. **복구 시도**: 60초 후 Primary 재시도

**사용 사례**:
- 프로덕션 환경
- 고가용성 필요
- Primary 장애 대비

**자세히 보기**: [Hybrid 가이드](hybrid/)

---

### Router 모드

JWT의 audience(aud)에 따라 다른 provider를 사용합니다.

```
Client (App A) → [Router]
                  ├─ aud: "app-a.com" → Provider A
                  ├─ aud: "app-b.com" → Provider B
                  ├─ aud: "*.internal.com" → Provider C
                  └─ aud: "*" (default) → Provider D
```

**설정 예시**:
```yaml
provider:
  type: router
  defaultProvider: "mysten"

  providers:
    app-a:
      type: local
      seed:
        type: env
        envVar: SEED_APP_A

    app-b:
      type: local
      seed:
        type: env
        envVar: SEED_APP_B

    mysten:
      type: remote
      endpoint: "https://salt.api.mystenlabs.com/get_salt"

  routes:
    - name: "app-a-route"
      match:
        audience: "app-a.example.com"
      provider: "app-a"

    - name: "app-b-route"
      match:
        audience: "app-b.example.com"
      provider: "app-b"
```

**장점**:
- ✅ 멀티테넌트 지원
- ✅ 앱별 독립적인 seed
- ✅ 유연한 라우팅 규칙 (와일드카드 지원)
- ✅ 점진적 마이그레이션 가능

**단점**:
- ❌ 복잡한 설정
- ❌ 여러 seed 관리 필요
- ❌ 고객사 추가 시마다 설정 업데이트

**라우팅 규칙**:
- **정확한 매칭**: `app-a.example.com`
- **와일드카드**: `*.example.com`, `prod-*`
- **Default**: 매칭되지 않으면 defaultProvider 사용

**사용 사례**:
- SaaS 플랫폼 (고객사별 분리)
- 멀티 앱 서비스 (App A, B, C)
- 환경별 분리 (Production, Staging, Dev)
- 점진적 마이그레이션 (기존 앱 → 신규 앱)

**자세히 보기**: [Router 가이드](router/)

---

## 비교표

### 기능 비교

| 기능 | Standalone | Proxy | Hybrid | Router |
|------|-----------|-------|--------|--------|
| **자체 Seed** | ✅ | ❌ | ✅ | ✅ |
| **외부 의존성** | ❌ | ✅ | 부분 | 부분 |
| **고가용성** | ❌ | ❌ | ✅ | 부분 |
| **멀티테넌트** | ❌ | ❌ | ❌ | ✅ |
| **설정 복잡도** | 낮음 | 낮음 | 중간 | 높음 |

### 성능 비교

| 항목 | Standalone | Proxy | Hybrid | Router |
|------|-----------|-------|--------|--------|
| **응답 시간** | ~50ms | ~200ms | ~50ms | ~50ms |
| **처리량** | 높음 | 중간 | 높음 | 높음 |
| **가용성** | 99% | 99% | 99.9% | 99.9% |

### 비용 비교 (월)

| 항목 | Standalone | Proxy | Hybrid | Router |
|------|-----------|-------|--------|--------|
| **Secrets Manager** | $0.40 | - | $0.40 | $0.40~2.00 |
| **Mysten Labs API** | - | 변동 | 변동 | 변동 |
| **인프라 (EC2)** | ~$122 | ~$122 | ~$122 | ~$122 |
| **총 예상 비용** | ~$122 | ~$122~200 | ~$122~200 | ~$122~300 |

---

## 선택 가이드

### 시작 단계

```
로컬 개발/테스트
    ↓
Standalone (01-env)
    ↓
간단하고 빠름!
```

### 프로덕션 단계

#### 소규모 서비스 (단일 앱)

```
Standalone (03-aws-secrets)
    ↓
AWS Secrets Manager 사용
    ↓
완전한 프라이버시
```

#### 고가용성 필요

```
Hybrid 모드
    ↓
Primary: 자체 seed
Fallback: Mysten Labs
    ↓
99.9% 가용성
```

#### SaaS 플랫폼 / 멀티 앱

```
Router 모드
    ↓
앱별 다른 provider
    ↓
멀티테넌트 지원
```

#### 점진적 마이그레이션

```
1. Proxy 모드 (Mysten Labs 프록시)
    ↓
2. Hybrid 모드 (자체 seed + Mysten 백업)
    ↓
3. Standalone 모드 (완전 독립)
```

### 의사결정 플로우차트

```
Q1: 여러 고객사/앱을 지원하나요?
    Yes → Router 모드
    No  → Q2

Q2: 고가용성(HA)이 필수인가요?
    Yes → Hybrid 모드
    No  → Q3

Q3: 완전한 프라이버시가 필요한가요?
    Yes → Standalone 모드
    No  → Q4

Q4: Mysten Labs를 사용하고 싶나요?
    Yes → Proxy 모드
    No  → Standalone 모드
```

---

## 실전 예시

### 예시 1: 스타트업 (초기 단계)

**상황**:
- 단일 앱
- 빠른 개발 필요
- 비용 최소화

**추천**: Proxy 모드
```yaml
provider:
  type: remote
  endpoint: "https://salt.api.mystenlabs.com/get_salt"
```

**장점**:
- Mysten Labs 인프라 활용
- 빠른 시작
- 나중에 마이그레이션 가능

### 예시 2: 중소기업 (성장 단계)

**상황**:
- 단일 앱
- 프라이버시 중요
- 안정성 필요

**추천**: Hybrid 모드
```yaml
provider:
  type: hybrid
  primary:
    type: local
    seed: # 자체 seed
  fallback:
    type: remote # Mysten Labs 백업
```

**장점**:
- 자체 seed로 프라이버시 확보
- Mysten Labs 백업으로 안정성 확보

### 예시 3: SaaS 플랫폼 (대기업)

**상황**:
- 여러 고객사 (멀티테넌트)
- 고객사별 데이터 격리 필요
- 엔터프라이즈 SLA 필요

**추천**: Router 모드
```yaml
provider:
  type: router
  defaultProvider: "mysten"

  providers:
    customer-a:
      type: local
      seed: # 고객사 A seed
    customer-b:
      type: local
      seed: # 고객사 B seed
    mysten:
      type: remote

  routes:
    - match: { audience: "customer-a.com" }
      provider: "customer-a"
    - match: { audience: "customer-b.com" }
      provider: "customer-b"
```

**장점**:
- 고객사별 독립적인 seed
- 데이터 격리
- Free tier는 Mysten Labs 사용

---

## 추가 리소스

### 통합 가이드
- **[📱 앱 통합 가이드](../sdk/integration-guide/)** - Express, React 등 실제 앱 통합 방법
- [SDK 통합 예제](../sdk/integration-guide/example-express-react/) - Express + React 완전한 예제
- [헬퍼 유틸리티](../sdk/integration-guide/utils.ts) - zkLogin 플로우 구현 함수들

### 내부 문서
- [Provider 인터페이스](../src/providers/)
- [Config 타입 정의](../src/types/index.ts)
- [JWT 검증](../src/services/jwt.service.ts)

### 배포 가이드
- [Docker 배포](../deploy/docker/)
- [Kubernetes 배포](../deploy/kubernetes/)
- [AWS Nitro Enclaves](../deploy/aws-nitro/)

### 외부 링크
- [Sui zkLogin 문서](https://docs.sui.io/concepts/cryptography/zklogin)
- [Mysten Labs Salt Server](https://blog.sui.io/zklogin-salt-server-architecture/)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [HashiCorp Vault](https://developer.hashicorp.com/vault/docs)

---

## 문의 및 지원

- **Issues**: [GitHub Issues](https://github.com/your-org/zklogin-salt-server/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/zklogin-salt-server/discussions)
- **Email**: support@example.com
