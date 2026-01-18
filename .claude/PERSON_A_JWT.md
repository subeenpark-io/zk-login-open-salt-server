# Person A: JWT & Auth 담당

## 담당 파일

```
src/
├── services/
│   └── jwt.service.ts    ⭐ 메인
├── config/
│   └── oauth-providers.ts
```

## 구현 체크리스트

### 1차 작업 (오전)

- [ ] `src/services/jwt.service.ts` 리팩토링
  - [ ] `src/types/index.ts`의 `VerifyResult`, `JWTClaims` 인터페이스 사용
  - [ ] JWKS 캐싱 로직 개선 (TTL 추가)
  - [ ] 에러 메시지 표준화

- [ ] `src/config/oauth-providers.ts` 확장
  - [ ] Kakao 추가: `https://kauth.kakao.com/.well-known/jwks.json`
  - [ ] Slack 추가 (필요시)
  - [ ] `OAuthProvider` 인터페이스 적용

### 2차 작업 (오후)

- [ ] JWKS 캐싱 고도화
  - [ ] 자동 갱신 (백그라운드)
  - [ ] 캐시 만료 처리

- [ ] 에러 핸들링 개선
  - [ ] 토큰 만료 에러
  - [ ] 서명 검증 실패
  - [ ] 알 수 없는 issuer

- [ ] 테스트 작성
  - [ ] `src/services/jwt.service.test.ts`

## 핵심 함수 시그니처

```typescript
// src/services/jwt.service.ts

import type { VerifyResult, JWTClaims, OAuthProvider } from '../types';

/**
 * JWT 검증 메인 함수
 */
export async function verifyJWT(token: string): Promise<VerifyResult>;

/**
 * issuer로 OAuth provider 찾기
 */
export function findProviderByIssuer(issuer: string): OAuthProvider | undefined;

/**
 * JWKS 가져오기 (캐싱 포함)
 */
export async function getJWKS(provider: OAuthProvider): Promise<jose.JWTVerifyGetKey>;
```

## 의존성

- `jose` - JWT 검증
- `src/types/index.ts` - 공통 타입

## 통합 포인트

Person C가 다음과 같이 호출:

```typescript
import { verifyJWT } from '../services/jwt.service';

const result = await verifyJWT(jwt);
if (!result.valid) {
  return c.json({ error: result.error }, 401);
}
// result.claims.sub, result.claims.aud 사용
```

## 테스트 방법

```bash
npm run test -- src/services/jwt.service.test.ts
```

## 참고 자료

- [jose 라이브러리](https://github.com/panva/jose)
- [Google JWKS](https://www.googleapis.com/oauth2/v3/certs)
- [Sui zkLogin 문서](https://docs.sui.io/concepts/cryptography/zklogin)
