## Router 모드: 멀티테넌트 라우팅

앱(audience)별로 다른 Salt Provider를 사용하는 멀티테넌트 환경을 구현합니다.

## 📋 개요

### 동작 방식

```
Client (App A) → [Router]
                  ├─ aud: "app-a.com" → Provider A (자체 seed-a)
                  ├─ aud: "app-b.com" → Provider B (자체 seed-b)
                  ├─ aud: "*.internal.com" → Provider C (내부용 seed)
                  └─ aud: "*" (default) → Provider D (Mysten Labs)
```

JWT의 `aud` (audience) 클레임을 기반으로 적절한 provider로 라우팅합니다.

### 사용 사례

✅ **SaaS 플랫폼**
- 고객사별로 다른 seed 사용
- 데이터 격리 및 프라이버시 보장

✅ **멀티 앱 서비스**
- App A, App B, App C가 동일한 Salt Server 공유
- 각 앱마다 독립적인 salt 생성

✅ **환경별 분리**
- Production, Staging, Development 환경별 다른 seed
- 내부 앱과 외부 앱 분리

✅ **점진적 마이그레이션**
- 기존 앱: Mysten Labs 사용
- 신규 앱: 자체 seed 사용
- 앱별로 순차적 마이그레이션

### 장점

✅ **멀티테넌트 지원**
- 단일 서버로 여러 고객사 지원
- 운영 비용 절감

✅ **유연한 라우팅**
- 와일드카드 패턴 지원 (`*.example.com`)
- Default fallback 설정 가능

✅ **독립적 관리**
- 고객사별 독립적인 seed 관리
- 한 고객사의 문제가 다른 고객사에 영향 없음

### 단점

❌ **복잡성 증가**
- 여러 provider 관리 필요
- 라우팅 규칙 설계 필요

❌ **설정 관리**
- 고객사 추가 시마다 설정 업데이트
- 복잡한 YAML 설정

## 전제 조건

- Node.js 22.5.0+
- npm 10.8.2+
- 여러 Master Seed (고객사별)

## 설정 파일 예시

### 예시 1: 간단한 멀티 앱

```yaml
server:
  port: 3000
  host: 0.0.0.0

logging:
  level: debug
  format: pretty

security:
  corsOrigins: "*"
  rateLimitMax: 100
  rateLimitWindowMs: 60000

provider:
  type: router

  # Default provider (매칭되지 않는 모든 요청)
  defaultProvider: "mysten"

  # Provider 정의
  providers:
    # App A: 자체 seed
    app-a:
      type: local
      seed:
        type: env
        envVar: SEED_APP_A

    # App B: 자체 seed
    app-b:
      type: local
      seed:
        type: env
        envVar: SEED_APP_B

    # Default: Mysten Labs
    mysten:
      type: remote
      endpoint: "https://salt.api.mystenlabs.com/get_salt"
      timeout: 10000

  # 라우팅 규칙 (순서대로 매칭)
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

### 예시 2: 복잡한 SaaS 플랫폼

```yaml
provider:
  type: router
  defaultProvider: "mysten"

  providers:
    # 고객사 A (Enterprise)
    customer-a:
      type: local
      seed:
        type: aws
        secretName: zklogin/customer-a-seed
        region: ap-northeast-2
        secretKey: masterSeed

    # 고객사 B (Enterprise)
    customer-b:
      type: local
      seed:
        type: aws
        secretName: zklogin/customer-b-seed
        region: ap-northeast-2
        secretKey: masterSeed

    # 내부 앱 (회사 내부용)
    internal:
      type: local
      seed:
        type: env
        envVar: INTERNAL_SEED

    # 테스트/개발 환경
    staging:
      type: local
      seed:
        type: env
        envVar: STAGING_SEED

    # Default: Mysten Labs (Free tier 고객)
    mysten:
      type: remote
      endpoint: "https://salt.api.mystenlabs.com/get_salt"

  routes:
    # 고객사 A (정확한 매칭)
    - name: "customer-a"
      match:
        audience: "customer-a.saas-platform.com"
      provider: "customer-a"

    # 고객사 B (정확한 매칭)
    - name: "customer-b"
      match:
        audience: "customer-b.saas-platform.com"
      provider: "customer-b"

    # 내부 앱 (와일드카드)
    - name: "internal-apps"
      match:
        audience: "*.internal.saas-platform.com"
      provider: "internal"

    # 테스트 환경 (와일드카드)
    - name: "staging-apps"
      match:
        audience: "*.staging.saas-platform.com"
      provider: "staging"

    # Default: 매칭되지 않으면 mysten 사용
```

### 예시 3: 점진적 마이그레이션

```yaml
provider:
  type: router
  defaultProvider: "mysten"  # 기존 앱들은 Mysten Labs 사용

  providers:
    # 신규 앱: 자체 seed
    new-apps:
      type: local
      seed:
        type: aws
        secretName: zklogin/new-apps-seed
        region: ap-northeast-2

    # 기존 앱: Mysten Labs
    mysten:
      type: remote
      endpoint: "https://salt.api.mystenlabs.com/get_salt"

  routes:
    # 신규 앱만 자체 seed 사용 (v2로 시작하는 앱)
    - name: "new-apps-v2"
      match:
        audience: "v2.*.example.com"
      provider: "new-apps"

    # 기존 앱: 매칭되지 않으면 default (mysten) 사용
```

## 라우팅 규칙

### 매칭 방식

```yaml
routes:
  # 1. 정확한 매칭
  - name: "exact-match"
    match:
      audience: "app.example.com"
    provider: "app-provider"

  # 2. 와일드카드 (서브도메인)
  - name: "subdomain-wildcard"
    match:
      audience: "*.example.com"
    provider: "subdomain-provider"

  # 3. 와일드카드 (모든 문자)
  - name: "prefix-wildcard"
    match:
      audience: "prod-*"
    provider: "production-provider"

  # 4. 여러 와일드카드
  - name: "complex-wildcard"
    match:
      audience: "*.prod.*.example.com"
    provider: "complex-provider"
```

### 우선순위

라우팅 규칙은 **배열 순서대로** 매칭됩니다:

```yaml
routes:
  # 먼저 확인: 구체적인 규칙
  - name: "specific"
    match:
      audience: "app.example.com"
    provider: "app-provider"

  # 나중에 확인: 와일드카드 규칙
  - name: "wildcard"
    match:
      audience: "*.example.com"
    provider: "wildcard-provider"

  # 매칭되지 않으면 defaultProvider 사용
```

**예시**:
- `app.example.com` → `app-provider` (첫 번째 규칙 매칭)
- `other.example.com` → `wildcard-provider` (두 번째 규칙 매칭)
- `unrelated.com` → `defaultProvider` (매칭 없음)

## 사용 방법

### 1. Master Seed 생성 (앱별)

```bash
# App A seed 생성
npm run generate-seed
# 출력: 0xaaa...

# App B seed 생성
npm run generate-seed
# 출력: 0xbbb...

# Internal seed 생성
npm run generate-seed
# 출력: 0xccc...
```

### 2. 환경변수 설정

```bash
# .env 파일 생성
cat > guides/router/.env << EOF
# App A seed
SEED_APP_A=0xaaa...

# App B seed
SEED_APP_B=0xbbb...

# Internal seed
INTERNAL_SEED=0xccc...

# Staging seed
STAGING_SEED=0xddd...
EOF
```

### 3. 개발 서버 실행

```bash
cd guides/router

# 서버 시작
./run-dev.sh
```

### 4. 테스트

#### App A 테스트

```bash
# App A용 JWT (aud: "app-a.example.com")
curl -X POST http://localhost:3000/v1/salt \
  -H 'Content-Type: application/json' \
  -d '{
    "jwt": "eyJ...aud=app-a.example.com"
  }'

# 응답: App A seed로 생성된 salt
# 로그: "Routing to provider app-a"
```

#### App B 테스트

```bash
# App B용 JWT (aud: "app-b.example.com")
curl -X POST http://localhost:3000/v1/salt \
  -H 'Content-Type: application/json' \
  -d '{
    "jwt": "eyJ...aud=app-b.example.com"
  }'

# 응답: App B seed로 생성된 salt (App A와 다름!)
# 로그: "Routing to provider app-b"
```

#### Default (Mysten Labs) 테스트

```bash
# 매칭되지 않는 JWT (aud: "other-app.com")
curl -X POST http://localhost:3000/v1/salt \
  -H 'Content-Type: application/json' \
  -d '{
    "jwt": "eyJ...aud=other-app.com"
  }'

# 응답: Mysten Labs에서 조회된 salt
# 로그: "Routing to provider mysten"
```

## 동작 확인

### 라우팅 로그 확인

```json
// 서버 로그 예시

// App A 요청
{
  "level": "debug",
  "message": "Routing to provider",
  "provider": "app-a",
  "aud": "app-a.example.com",
  "timestamp": "2026-01-31T00:00:00.000Z"
}

// App B 요청
{
  "level": "debug",
  "message": "Routing to provider",
  "provider": "app-b",
  "aud": "app-b.example.com",
  "timestamp": "2026-01-31T00:00:01.000Z"
}

// Default 요청
{
  "level": "debug",
  "message": "Routing to provider",
  "provider": "mysten",
  "aud": "unknown-app.com",
  "timestamp": "2026-01-31T00:00:02.000Z"
}
```

### Salt 값 비교

동일한 사용자(sub)라도 앱(aud)에 따라 다른 salt를 받아야 합니다:

```bash
# 사용자 alice, App A
curl -X POST http://localhost:3000/v1/salt \
  -d '{"jwt": "...sub=alice&aud=app-a.example.com"}'
# 응답: {"salt": "0x111..."}

# 동일 사용자 alice, App B
curl -X POST http://localhost:3000/v1/salt \
  -d '{"jwt": "...sub=alice&aud=app-b.example.com"}'
# 응답: {"salt": "0x222..."}  ← 다른 salt!
```

## 실제 구현 예시

### JWT 생성 (테스트용)

```typescript
// generate-test-jwt-with-aud.ts
import { SignJWT } from 'jose';

async function generateJWT(aud: string) {
  const secret = new TextEncoder().encode('test-secret');

  const jwt = await new SignJWT({
    sub: 'test-user-123',
    aud: aud,
    iat: Math.floor(Date.now() / 1000),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('https://accounts.google.com')
    .setExpirationTime('1h')
    .sign(secret);

  return jwt;
}

// 사용 예시
const jwtAppA = await generateJWT('app-a.example.com');
const jwtAppB = await generateJWT('app-b.example.com');
const jwtOther = await generateJWT('other-app.com');

console.log('App A JWT:', jwtAppA);
console.log('App B JWT:', jwtAppB);
console.log('Other JWT:', jwtOther);
```

### 라우팅 로직 이해

```typescript
// src/providers/router.provider.ts (simplified)

class RouterProvider {
  private providers: Map<string, SaltProvider>;
  private routes: RouterRule[];
  private defaultProvider: string;

  async getSalt(sub: string, aud: string, jwt?: string): Promise<string> {
    // 1. aud로 provider 결정
    const providerName = this.resolveProvider(aud);

    // 2. Provider 조회
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    // 3. Salt 생성
    logger.debug("Routing to provider", { provider: providerName, aud });
    return provider.getSalt(sub, aud, jwt);
  }

  private resolveProvider(aud: string): string {
    // 라우팅 규칙 순회
    for (const rule of this.routes) {
      if (this.matchesRule(rule, aud)) {
        return rule.provider;
      }
    }

    // 매칭되지 않으면 default
    return this.defaultProvider;
  }

  private matchesRule(rule: RouterRule, aud: string): boolean {
    if (rule.match.audience) {
      // 와일드카드를 정규식으로 변환
      const pattern = rule.match.audience.replace(/\*/g, ".*");
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(aud);
    }

    return false;
  }
}
```

### 커스텀 라우팅 로직 추가

```typescript
// src/providers/router.provider.ts

// 예시: 사용자 ID 기반 라우팅
private resolveProvider(sub: string, aud: string): string {
  // VIP 사용자는 프리미엄 provider 사용
  if (this.isVIPUser(sub)) {
    return 'premium-provider';
  }

  // 기존 aud 기반 라우팅
  for (const rule of this.routes) {
    if (this.matchesRule(rule, aud)) {
      return rule.provider;
    }
  }

  return this.defaultProvider;
}

private isVIPUser(sub: string): boolean {
  // 구현 예시
  return sub.startsWith('vip-');
}
```

### 동적 Provider 추가

```typescript
// src/routes/admin.route.ts

import { RouterProvider } from '../providers/router.provider.js';

app.post('/admin/providers', async (c) => {
  const { name, config } = await c.req.json();

  // 새 provider 추가
  const provider = await createProviderFromConfig(config);
  (globalProvider as RouterProvider).providers.set(name, provider);

  return c.json({ success: true, provider: name });
});

app.post('/admin/routes', async (c) => {
  const { rule } = await c.req.json();

  // 새 라우팅 규칙 추가
  (globalProvider as RouterProvider).routes.push(rule);

  return c.json({ success: true, rule });
});
```

## 프로덕션 배포

### Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: zklogin-router-config
data:
  config.yaml: |
    provider:
      type: router
      defaultProvider: "mysten"

      providers:
        customer-a:
          type: local
          seed:
            type: aws
            secretName: zklogin/customer-a-seed
            region: ap-northeast-2

        customer-b:
          type: local
          seed:
            type: aws
            secretName: zklogin/customer-b-seed
            region: ap-northeast-2

        mysten:
          type: remote
          endpoint: "https://salt.api.mystenlabs.com/get_salt"

      routes:
        - name: "customer-a"
          match:
            audience: "customer-a.platform.com"
          provider: "customer-a"

        - name: "customer-b"
          match:
            audience: "customer-b.platform.com"
          provider: "customer-b"
```

### 고객사 추가 자동화

```bash
#!/bin/bash
# add-customer.sh

CUSTOMER_NAME=$1
AUD=$2

# 1. Master Seed 생성
SEED=$(npm run generate-seed --silent | tail -1)

# 2. AWS Secrets Manager에 저장
aws secretsmanager create-secret \
  --name "zklogin/${CUSTOMER_NAME}-seed" \
  --secret-string "{\"masterSeed\": \"$SEED\"}" \
  --region ap-northeast-2

# 3. config.yaml 업데이트
cat >> config.yaml << EOF

    ${CUSTOMER_NAME}:
      type: local
      seed:
        type: aws
        secretName: zklogin/${CUSTOMER_NAME}-seed
        region: ap-northeast-2
EOF

# 4. 라우팅 규칙 추가
cat >> config.yaml << EOF

    - name: "${CUSTOMER_NAME}-route"
      match:
        audience: "${AUD}"
      provider: "${CUSTOMER_NAME}"
EOF

# 5. 서버 재시작
kubectl rollout restart deployment/zklogin-router

echo "✅ Customer ${CUSTOMER_NAME} added successfully"
echo "   Audience: ${AUD}"
echo "   Seed: ${SEED:0:20}...${SEED: -20}"
```

사용 예시:
```bash
./add-customer.sh customer-c customer-c.platform.com
```

## 모니터링

### Provider별 메트릭

```typescript
import { Counter, Histogram } from 'prom-client';

const requestsByProvider = new Counter({
  name: 'zklogin_requests_by_provider_total',
  help: 'Total requests by provider',
  labelNames: ['provider', 'status'],
});

const responseTimeByProvider = new Histogram({
  name: 'zklogin_response_time_by_provider_seconds',
  help: 'Response time by provider',
  labelNames: ['provider'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

// RouterProvider.getSalt() 내부
const end = responseTimeByProvider.startTimer({ provider: providerName });
try {
  const salt = await provider.getSalt(sub, aud, jwt);
  requestsByProvider.inc({ provider: providerName, status: 'success' });
  return salt;
} catch (error) {
  requestsByProvider.inc({ provider: providerName, status: 'error' });
  throw error;
} finally {
  end();
}
```

### Grafana 대시보드

```json
{
  "dashboard": {
    "title": "zkLogin Router Metrics",
    "panels": [
      {
        "title": "Requests by Provider",
        "targets": [
          {
            "expr": "rate(zklogin_requests_by_provider_total[5m])"
          }
        ]
      },
      {
        "title": "Response Time by Provider",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(zklogin_response_time_by_provider_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Error Rate by Provider",
        "targets": [
          {
            "expr": "rate(zklogin_requests_by_provider_total{status=\"error\"}[5m])"
          }
        ]
      }
    ]
  }
}
```

## 문제 해결

### Provider를 찾을 수 없음

```bash
# 로그: "Provider not found: app-a"

# 1. config.yaml 확인
cat config.yaml | grep -A 10 "providers:"

# 2. Provider 이름 확인
# routes[].provider가 providers의 key와 일치하는지 확인

# 3. 서버 재시작
./run-dev.sh
```

### 라우팅이 예상과 다름

```bash
# 로그: "Routing to provider mysten" (예상: app-a)

# 1. 라우팅 규칙 확인
cat config.yaml | grep -A 20 "routes:"

# 2. audience 매칭 테스트
# JWT의 aud 클레임이 정확한지 확인

# 3. 순서 확인
# 더 구체적인 규칙이 먼저 와야 함
```

### 특정 Provider가 실패함

```bash
# 로그: "Provider app-a failed: MASTER_SEED not loaded"

# 1. Provider 상태 확인
curl http://localhost:3000/ready

# 2. Seed 확인 (env 사용 시)
echo $SEED_APP_A

# 3. AWS Secrets Manager 확인 (AWS 사용 시)
aws secretsmanager get-secret-value \
  --secret-id zklogin/app-a-seed \
  --region ap-northeast-2

# 4. 해당 Provider만 재시작
# 전체 서버 재시작 필요
```

## 비용 분석

### SaaS 플랫폼 예시

**고객 구성**:
- Enterprise 고객 5개: 자체 seed (AWS Secrets Manager)
- Standard 고객 50개: Mysten Labs 사용

**월 비용**:
```
Enterprise:
- AWS Secrets Manager: $0.40 × 5 = $2.00
- AWS 요청: 무시할 수 있는 수준

Standard:
- Mysten Labs API: 요청당 비용
- 예상: $10~50 (요청 횟수에 따라)

인프라:
- EC2/ECS: ~$50~200
- 데이터 전송: ~$10~50

총 예상 비용: $72~302/월
```

**비용 절감 전략**:
1. Enterprise 고객 유치 (자체 seed = 비용 없음)
2. 캐싱으로 Mysten Labs 호출 감소
3. Auto Scaling으로 인프라 비용 최적화

## 다음 단계

- [Standalone 모드](../standalone/): 완전 독립 운영
- [Hybrid 모드](../hybrid/): Primary + Fallback
- [Proxy 모드](../proxy/): 외부 서버 프록시

## 추가 리소스

- [RouterProvider 구현](../../src/providers/router.provider.ts)
- [라우팅 규칙 타입](../../src/types/index.ts)
- [JWT 클레임 추출](../../src/services/jwt.service.ts)
