# Hybrid 모드: Primary + Fallback

자체 Salt Server를 Primary로 사용하고, 외부 서버(Mysten Labs)를 Fallback으로 설정하여 고가용성(HA)을 구현합니다.

## 📋 개요

### 동작 방식

```
Client → [Your Salt Server (Hybrid)]
         ├─ Primary: Local (자체 seed)
         │  └─ 실패 시 ↓
         └─ Fallback: Mysten Labs (외부 서버)
```

### 장점

✅ **고가용성 (HA)**
- Primary 실패 시 자동으로 Fallback 사용
- 99.9% 이상 가용성 달성

✅ **자체 제어권 유지**
- 정상 시에는 자체 seed 사용 (프라이버시)
- 장애 시에만 Mysten Labs 사용

✅ **점진적 복구**
- Fallback 사용 후 일정 시간 뒤 Primary 재시도
- 자동 복구 메커니즘

### 단점

❌ **복잡성 증가**
- 두 개의 provider 관리 필요
- 설정이 복잡함

❌ **Fallback 의존성**
- Mysten Labs도 다운되면 서비스 중단
- 완전한 독립성은 보장되지 않음

## 전제 조건

- Node.js 22.5.0+
- npm 10.8.2+
- Master Seed (자체 생성)

## 설정 파일

### config.yaml

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
  type: hybrid

  # Primary: 자체 seed (Local Provider)
  primary:
    type: local
    seed:
      type: env
      envVar: MASTER_SEED
      # 또는 AWS Secrets Manager 사용:
      # type: aws
      # secretName: zklogin/prod-seed
      # region: ap-northeast-2
      # secretKey: masterSeed

  # Fallback: Mysten Labs (Remote Provider)
  fallback:
    type: remote
    endpoint: "https://salt.api.mystenlabs.com/get_salt"
    timeout: 10000
    retryCount: 2

  # Fallback 설정
  fallbackEnabled: true
  fallbackAfterSeconds: 60  # Primary 실패 후 60초 동안 Fallback 사용
```

### 설정 옵션

| 옵션 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `primary` | Yes | - | Primary provider 설정 (LocalProvider) |
| `fallback` | Yes | - | Fallback provider 설정 (RemoteProvider) |
| `fallbackEnabled` | No | true | Fallback 활성화 여부 |
| `fallbackAfterSeconds` | No | 60 | Fallback 사용 후 Primary 재시도 대기 시간 (초) |

## 사용 방법

### 1. Master Seed 생성

```bash
# Seed 생성
npm run generate-seed

# 출력 예시:
# 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
```

### 2. 환경변수 설정

```bash
# .env 파일 생성
cat > guides/hybrid/.env << EOF
MASTER_SEED=0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
EOF
```

### 3. 개발 서버 실행

```bash
cd guides/hybrid

# 서버 시작
./run-dev.sh
```

### 4. 테스트

새 터미널을 열고:

```bash
# Health check
curl http://localhost:3000/health

# Ready check
curl http://localhost:3000/ready

# Salt API (정상 상태 - Primary 사용)
curl -X POST http://localhost:3000/v1/salt \
  -H 'Content-Type: application/json' \
  -d '{"jwt": "YOUR_JWT_HERE"}'
```

## 동작 시나리오

### 시나리오 1: 정상 상태

```
1. Client → Salt 요청
2. Primary (Local) → Salt 생성 ✅
3. Client ← Salt 응답
```

**로그**:
```
[INFO] Primary provider is healthy
[DEBUG] Using primary provider for salt generation
```

### 시나리오 2: Primary 실패

```
1. Client → Salt 요청
2. Primary (Local) → 실패 ❌
3. Fallback (Mysten) → Salt 조회 ✅
4. Client ← Salt 응답
```

**로그**:
```
[ERROR] Primary provider failed: MASTER_SEED environment variable is required
[INFO] Falling back to remote provider
[DEBUG] Using fallback provider for salt generation
```

### 시나리오 3: Fallback 사용 중 (60초 이내)

```
1. Client → Salt 요청
2. ⏭️  Primary 건너뜀 (최근 실패로 인해)
3. Fallback (Mysten) → Salt 조회 ✅
4. Client ← Salt 응답
```

**로그**:
```
[INFO] Using fallback provider due to recent primary failure
[DEBUG] Elapsed time since primary failure: 35s
```

### 시나리오 4: Primary 복구 재시도 (60초 경과)

```
1. Client → Salt 요청
2. Primary (Local) → Salt 생성 ✅ (복구됨!)
3. Client ← Salt 응답
4. ✅ Primary 정상 상태로 복귀
```

**로그**:
```
[DEBUG] Attempting to use primary provider (retry)
[INFO] Primary provider recovered successfully
```

## Fallback 동작 확인

### 1. 정상 상태 테스트

```bash
# Primary가 정상적으로 동작
curl -X POST http://localhost:3000/v1/salt \
  -H 'Content-Type: application/json' \
  -d '{"jwt": "YOUR_JWT"}' \
  -w "\nTime: %{time_total}s\n"

# 응답 시간: ~50ms (로컬 생성)
```

### 2. Primary 실패 시뮬레이션

```bash
# 1. MASTER_SEED를 잘못된 값으로 변경
export MASTER_SEED=invalid

# 2. 서버 재시작
./run-dev.sh

# 3. Salt 요청
curl -X POST http://localhost:3000/v1/salt \
  -H 'Content-Type: application/json' \
  -d '{"jwt": "YOUR_JWT"}' \
  -w "\nTime: %{time_total}s\n"

# 응답 시간: ~200ms (Mysten Labs 호출)
# 로그: "Falling back to remote provider"
```

### 3. Fallback 지속 시간 테스트

```bash
# Primary 실패 후 60초 동안 계속 Fallback 사용

# 즉시 요청
curl -X POST http://localhost:3000/v1/salt ...
# 로그: "Falling back to remote provider"

# 30초 후 요청
sleep 30
curl -X POST http://localhost:3000/v1/salt ...
# 로그: "Using fallback provider due to recent primary failure"

# 60초 후 요청
sleep 30
curl -X POST http://localhost:3000/v1/salt ...
# 로그: "Attempting to use primary provider (retry)"
```

## 프로덕션 배포

### AWS Secrets Manager 사용

```yaml
provider:
  type: hybrid

  primary:
    type: local
    seed:
      type: aws
      secretName: zklogin/prod-seed
      region: ap-northeast-2
      secretKey: masterSeed

  fallback:
    type: remote
    endpoint: "https://salt.api.mystenlabs.com/get_salt"
    timeout: 10000

  fallbackEnabled: true
  fallbackAfterSeconds: 300  # 5분으로 증가 (프로덕션)
```

### Docker Compose

```yaml
version: '3.8'

services:
  salt-server:
    image: zklogin-hybrid:latest
    ports:
      - "3000:3000"
    environment:
      - CONFIG_FILE=/config/config.yaml
      - AWS_REGION=ap-northeast-2
      # AWS 자격 증명은 IAM Role 사용 권장
    volumes:
      - ./config.yaml:/config/config.yaml
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zklogin-hybrid
spec:
  replicas: 3
  selector:
    matchLabels:
      app: zklogin-hybrid
  template:
    metadata:
      labels:
        app: zklogin-hybrid
    spec:
      serviceAccountName: zklogin-sa
      containers:
      - name: hybrid
        image: zklogin-hybrid:latest
        ports:
        - containerPort: 3000
        env:
        - name: CONFIG_FILE
          value: /config/config.yaml
        - name: AWS_REGION
          value: ap-northeast-2
        volumeMounts:
        - name: config
          mountPath: /config
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
      volumes:
      - name: config
        configMap:
          name: zklogin-hybrid-config
```

## 모니터링

### CloudWatch Alarms

```bash
# Primary 실패 알람
aws cloudwatch put-metric-alarm \
  --alarm-name zklogin-primary-failure \
  --alarm-description "Primary provider is failing" \
  --metric-name PrimaryFailureCount \
  --namespace ZkLogin \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# Fallback 사용 알람
aws cloudwatch put-metric-alarm \
  --alarm-name zklogin-using-fallback \
  --alarm-description "Using fallback provider" \
  --metric-name FallbackUsageCount \
  --namespace ZkLogin \
  --statistic Sum \
  --period 60 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

### 메트릭 로깅

```typescript
// src/providers/hybrid.provider.ts
import { Counter } from 'prom-client';

const primaryFailureCounter = new Counter({
  name: 'zklogin_primary_failures_total',
  help: 'Total number of primary provider failures',
});

const fallbackUsageCounter = new Counter({
  name: 'zklogin_fallback_usage_total',
  help: 'Total number of times fallback was used',
});

// HybridProvider.getSalt() 내부
try {
  const salt = await this.primary.getSalt(sub, aud);
  this.primaryFailedAt = null;
  return salt;
} catch (error) {
  primaryFailureCounter.inc();
  this.primaryFailedAt = Date.now();

  if (this.fallbackEnabled) {
    fallbackUsageCounter.inc();
    return this.fallback.getSalt(sub, aud, jwt);
  }

  throw error;
}
```

## 문제 해결

### Primary가 계속 실패하는 경우

```bash
# 1. Primary 상태 확인
curl http://localhost:3000/ready

# 2. 로그 확인
# 서버 로그에서 Primary 실패 원인 확인

# 3. Master Seed 확인
echo $MASTER_SEED
# 32바이트 (64 hex characters)인지 확인

# 4. AWS Secrets Manager 확인 (AWS 사용 시)
aws secretsmanager get-secret-value \
  --secret-id zklogin/prod-seed \
  --region ap-northeast-2
```

### Fallback도 실패하는 경우

```bash
# 1. Mysten Labs 상태 확인
curl https://salt.api.mystenlabs.com/health

# 2. 네트워크 연결 확인
curl -v https://salt.api.mystenlabs.com/get_salt

# 3. Fallback 설정 확인
cat config.yaml | grep -A 5 "fallback:"
```

### Fallback에서 Primary로 복귀하지 않는 경우

```bash
# fallbackAfterSeconds 확인
cat config.yaml | grep fallbackAfterSeconds

# 로그에서 복귀 시도 확인
# "Attempting to use primary provider (retry)" 메시지 확인

# Primary 문제가 해결되었는지 확인
# Primary가 정상이면 자동으로 복귀됨
```

## 장애 시나리오별 대응

### 시나리오 A: Primary 일시적 장애

**증상**: Primary가 5-10분 동안 실패

**대응**:
1. ✅ Fallback이 자동으로 처리
2. ⏰ `fallbackAfterSeconds` 경과 후 자동 복귀
3. 📊 알람 확인 및 원인 분석

### 시나리오 B: Primary 영구적 장애

**증상**: Primary가 계속 실패

**대응**:
1. ✅ Fallback으로 서비스 지속
2. 🔧 Primary 문제 해결:
   - Master Seed 재생성
   - AWS Secrets Manager 복구
   - 인프라 점검
3. ✅ 복구 후 자동으로 Primary로 복귀

### 시나리오 C: Fallback도 장애

**증상**: Primary와 Fallback 모두 실패

**대응**:
1. ❌ 서비스 중단
2. 🚨 즉시 대응 필요:
   - Primary 복구 (우선)
   - 대체 Fallback 설정
   - Mysten Labs 상태 확인
3. 🔄 복구 후 서비스 재개

## 비용 분석

### Primary 정상 시

- **Primary (Local)**: 무료
- **Fallback (Mysten)**: 사용하지 않음
- **총 비용**: EC2/서버 비용만

### Primary 장애 시

- **Primary (Local)**: 사용하지 않음
- **Fallback (Mysten)**: 요청당 비용 발생
- **총 비용**: EC2 + Mysten Labs API 비용

### 권장 설정

```yaml
# 프로덕션 권장 설정
fallbackEnabled: true
fallbackAfterSeconds: 300  # 5분

# 장점:
# - Primary 일시적 장애에 대응
# - 5분마다 Primary 복귀 시도
# - Mysten Labs 비용 최소화
```

## 다음 단계

- [Router 모드](../router/): 멀티테넌트 라우팅
- [Standalone 모드](../standalone/): 완전 독립 운영
- [Proxy 모드](../proxy/): 외부 서버 프록시
