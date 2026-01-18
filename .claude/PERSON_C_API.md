# Person C: API & 통합 담당

## 담당 파일

```
src/
├── config/
│   └── index.ts
├── routes/
│   ├── index.ts
│   ├── salt.route.ts    ⭐ 메인 API
│   ├── health.route.ts
│   └── admin.route.ts
├── middleware/
│   ├── error-handler.ts
│   ├── rate-limit.ts
│   └── tenant.ts
├── utils/
│   └── logger.ts
└── main.ts              ⭐ 진입점
```

## 구현 체크리스트

### 1차 작업 (오전)

- [ ] `src/types/index.ts`의 타입 적용
  - [ ] `SaltRequest`, `SaltResponse`, `ErrorResponse` 사용
  - [ ] `AppConfig` 적용

- [ ] `src/config/index.ts` 리팩토링
  - [ ] zod 스키마 검증 추가 (옵션)
  - [ ] `AppConfig` 인터페이스 적용

- [ ] `src/routes/salt.route.ts` 수정
  - [ ] Person A의 `verifyJWT` 호출
  - [ ] Person B의 `provider.getSalt` 호출

### 2차 작업 (오후)

- [ ] `src/middleware/rate-limit.ts` 개선
  - [ ] IP별 rate limiting
  - [ ] 헤더 설정 (X-RateLimit-*)

- [ ] `src/middleware/error-handler.ts` 개선
  - [ ] 에러 타입별 처리
  - [ ] 로깅 (민감정보 제외)

- [ ] `src/routes/health.route.ts` 개선
  - [ ] Provider 헬스체크 통합

- [ ] 테스트 작성
  - [ ] `src/routes/salt.route.test.ts`

## 핵심 API 스펙

### POST /v1/salt

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

Error (400/401/500):
```json
{
  "error": "error_code",
  "message": "Human readable message"
}
```

### GET /health

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 통합 코드 예시

```typescript
// src/routes/salt.route.ts

import { Hono } from 'hono';
import { verifyJWT } from '../services/jwt.service';  // Person A
import { getProvider } from '../main';                 // Person B
import type { SaltRequest, SaltResponse, ErrorResponse } from '../types';

export const saltRoutes = new Hono();

saltRoutes.post('/salt', async (c) => {
  const body = await c.req.json<SaltRequest>();

  if (!body.jwt) {
    return c.json<ErrorResponse>({ error: 'missing_jwt', message: 'JWT is required' }, 400);
  }

  // 1. JWT 검증 (Person A)
  const result = await verifyJWT(body.jwt);
  if (!result.valid) {
    return c.json<ErrorResponse>({ error: 'invalid_jwt', message: result.error! }, 401);
  }

  // 2. Salt 생성 (Person B)
  const provider = await getProvider();
  const aud = Array.isArray(result.claims!.aud) ? result.claims!.aud[0] : result.claims!.aud;
  const salt = await provider.getSalt(result.claims!.sub, aud, body.jwt);

  return c.json<SaltResponse>({ salt });
});
```

## 의존성

- `hono` - Web framework
- Person A의 `verifyJWT`
- Person B의 `createProvider`

## 환경변수

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `PORT` | No | 3000 | 서버 포트 |
| `LOG_LEVEL` | No | info | 로그 레벨 |
| `RATE_LIMIT_MAX` | No | 100 | 분당 최대 요청 |
| `CORS_ORIGINS` | No | * | CORS 허용 오리진 |
| `SALT_PROVIDER_MODE` | No | local | Provider 모드 |
| `MASTER_SEED` | * | - | 마스터 시드 (local 모드) |

## 테스트 방법

```bash
# 서버 실행
MASTER_SEED=0x$(openssl rand -hex 32) npm run dev

# API 테스트
curl -X POST http://localhost:3000/v1/salt \
  -H "Content-Type: application/json" \
  -d '{"jwt": "test-jwt"}'

# Health 체크
curl http://localhost:3000/health
```

## 주의사항

1. **에러 메시지**: 내부 상태 노출하지 않기
2. **CORS**: 프로덕션에서 특정 도메인만 허용
3. **Rate Limiting**: 무차별 대입 공격 방지
4. **로깅**: JWT 전체, Salt, Seed 로깅 금지

## 참고 자료

- [Hono 문서](https://hono.dev/)
- [Mysten Labs Salt API](https://docs.sui.io/concepts/cryptography/zklogin)
