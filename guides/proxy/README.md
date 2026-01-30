# Proxy 모드: 외부 Salt Server 프록시

외부 Salt Server (예: Mysten Labs)를 프록시하면서 캐싱, rate limiting, 로깅 등을 추가할 수 있습니다.

## 📋 개요

### 동작 방식

```
Client → [Your Salt Server (Proxy)] → [Mysten Labs Salt Server]
          ↓
       캐싱, Rate Limiting, 로깅 추가
```

### 장점

✅ **제어권 유지**
- Mysten Labs의 인프라를 사용하면서도 자체 서버 유지
- 캐싱으로 응답 속도 개선
- Rate limiting으로 비용 절감
- 로깅 및 모니터링 추가

✅ **점진적 마이그레이션**
- 초기에는 Mysten Labs 사용
- 나중에 자체 seed로 전환 가능

✅ **백업 옵션**
- Mysten Labs가 다운되어도 로그 확인 가능
- 캐시된 응답으로 일부 요청 처리 가능

### 단점

❌ **Mysten Labs 의존성**
- Mysten Labs가 다운되면 서비스 중단
- Mysten Labs의 rate limit에 영향

❌ **프라이버시 제한**
- 사용자 데이터가 Mysten Labs로 전송됨
- 완전한 프라이버시를 원하면 Standalone 모드 사용

## 전제 조건

- Node.js 22.5.0+
- npm 10.8.2+

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
  type: remote
  endpoint: "https://salt.api.mystenlabs.com/get_salt"
  timeout: 10000
  retryCount: 2
  # apiKey: "optional-api-key"  # API key가 필요한 경우
```

### 설정 옵션

| 옵션 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `endpoint` | Yes | - | 원격 Salt Server URL |
| `timeout` | No | 10000 | 요청 타임아웃 (ms) |
| `retryCount` | No | 0 | 재시도 횟수 |
| `apiKey` | No | - | API 키 (필요한 경우) |

## 사용 방법

### 1. 개발 서버 실행

```bash
cd guides/proxy

# 서버 시작
./run-dev.sh
```

### 2. 테스트

새 터미널을 열고:

```bash
# Health check
curl http://localhost:3000/health

# Ready check
curl http://localhost:3000/ready

# Salt API (실제 JWT 필요)
curl -X POST http://localhost:3000/v1/salt \
  -H 'Content-Type: application/json' \
  -d '{"jwt": "YOUR_GOOGLE_JWT_HERE"}'
```

## 동작 확인

### 1. Mysten Labs 응답 확인

```bash
# Mysten Labs 직접 호출
curl -X POST https://salt.api.mystenlabs.com/get_salt \
  -H 'Content-Type: application/json' \
  -d '{"jwt": "YOUR_JWT"}'
```

### 2. 프록시 서버 응답 확인

```bash
# 프록시 서버 호출
curl -X POST http://localhost:3000/v1/salt \
  -H 'Content-Type: application/json' \
  -d '{"jwt": "YOUR_JWT"}'
```

두 응답이 동일한 salt 값을 반환해야 합니다.

## 캐싱 추가 (선택)

캐싱을 추가하려면 코드 수정이 필요합니다:

```typescript
// src/routes/salt.route.ts
import { LRUCache } from 'lru-cache';

// 캐시 생성 (최대 1000개, 1시간 TTL)
const cache = new LRUCache<string, string>({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1시간
});

// Salt API 핸들러
app.post('/v1/salt', async (c) => {
  const { sub, aud } = extractedClaims;

  // 캐시 키 생성
  const cacheKey = `${sub}:${aud}`;

  // 캐시 확인
  const cached = cache.get(cacheKey);
  if (cached) {
    return c.json({ salt: cached });
  }

  // Provider에서 salt 조회
  const salt = await provider.getSalt(sub, aud, jwt);

  // 캐시 저장
  cache.set(cacheKey, salt);

  return c.json({ salt });
});
```

## Mysten Labs Endpoints

### 프로덕션
```
https://salt.api.mystenlabs.com/get_salt
```

### 테스트넷 (Devnet)
```
https://salt.api.testnet.mystenlabs.com/get_salt
```

## 프로덕션 배포

### Docker

```dockerfile
FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
COPY guides/proxy/config.yaml ./config.yaml

ENV NODE_ENV=production
ENV CONFIG_FILE=/app/config.yaml

CMD ["node", "dist/main.js"]
```

빌드 및 실행:

```bash
docker build -t zklogin-proxy .
docker run -p 3000:3000 zklogin-proxy
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zklogin-proxy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: zklogin-proxy
  template:
    metadata:
      labels:
        app: zklogin-proxy
    spec:
      containers:
      - name: proxy
        image: zklogin-proxy:latest
        ports:
        - containerPort: 3000
        env:
        - name: CONFIG_FILE
          value: /config/config.yaml
        volumeMounts:
        - name: config
          mountPath: /config
      volumes:
      - name: config
        configMap:
          name: zklogin-proxy-config
---
apiVersion: v1
kind: Service
metadata:
  name: zklogin-proxy
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: zklogin-proxy
```

## 모니터링

### Prometheus 메트릭

```typescript
import { Counter, Histogram } from 'prom-client';

const requestCounter = new Counter({
  name: 'salt_requests_total',
  help: 'Total number of salt requests',
  labelNames: ['status'],
});

const requestDuration = new Histogram({
  name: 'salt_request_duration_seconds',
  help: 'Salt request duration in seconds',
});

// 사용 예시
const end = requestDuration.startTimer();
try {
  const salt = await provider.getSalt(sub, aud, jwt);
  requestCounter.inc({ status: 'success' });
  return salt;
} catch (error) {
  requestCounter.inc({ status: 'error' });
  throw error;
} finally {
  end();
}
```

### CloudWatch Logs (AWS)

```typescript
import winston from 'winston';
import CloudWatchTransport from 'winston-cloudwatch';

const logger = winston.createLogger({
  transports: [
    new CloudWatchTransport({
      logGroupName: '/zklogin/proxy',
      logStreamName: 'salt-requests',
      awsRegion: 'ap-northeast-2',
    }),
  ],
});

logger.info('Salt request', { sub, aud, provider: 'mysten' });
```

## 비용 절감

### 1. 캐싱 전략

```typescript
// 결정론적 salt는 영구 캐싱 가능
const cache = new LRUCache<string, string>({
  max: 10000,
  ttl: Infinity, // 영구 캐싱
});
```

### 2. Rate Limiting

```yaml
security:
  rateLimitMax: 100      # 분당 최대 100 요청
  rateLimitWindowMs: 60000  # 1분 윈도우
```

### 3. 배치 요청

여러 요청을 배치로 처리:

```typescript
const batchSize = 10;
const batch = [];

for (const request of requests) {
  batch.push(request);

  if (batch.length >= batchSize) {
    await processBatch(batch);
    batch.length = 0;
  }
}
```

## 문제 해결

### Mysten Labs 연결 실패

```bash
# Mysten Labs 상태 확인
curl https://salt.api.mystenlabs.com/health

# DNS 확인
nslookup salt.api.mystenlabs.com

# 네트워크 확인
ping salt.api.mystenlabs.com
```

### 타임아웃 에러

```yaml
# config.yaml에서 타임아웃 증가
provider:
  type: remote
  endpoint: "https://salt.api.mystenlabs.com/get_salt"
  timeout: 30000  # 30초로 증가
  retryCount: 3   # 재시도 추가
```

### Rate Limit 초과

Mysten Labs에서 429 에러가 발생하면:

1. **캐싱 추가**: 동일한 요청 캐싱
2. **Rate Limiting**: 클라이언트별 제한
3. **자체 Seed 사용**: Standalone 모드로 전환

## 다음 단계

- [Hybrid 모드](../hybrid/): Primary + Fallback 설정
- [Router 모드](../router/): 멀티테넌트 라우팅
- [Standalone 모드](../standalone/): 완전 독립 운영
