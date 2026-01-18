# Person B: Salt Providers 담당

## 담당 파일

```
src/
├── providers/
│   ├── index.ts      ⭐ 팩토리 & export
│   ├── local.provider.ts     ⭐ 핵심!
│   ├── remote.provider.ts
│   └── hybrid.provider.ts
├── services/
│   └── seed.service.ts
├── utils/
│   └── crypto.ts
```

## 구현 체크리스트

### 1차 작업 (오전)

- [ ] `src/types/index.ts`의 `SaltProvider` 인터페이스 적용
  - [ ] `local.provider.ts` 수정
  - [ ] `remote.provider.ts` 수정
  - [ ] `hybrid.provider.ts` 수정

- [ ] `src/providers/index.ts` 팩토리 함수 추가
  ```typescript
  export function createProvider(config: ProviderConfig): Promise<SaltProvider>
  ```

- [ ] `src/utils/crypto.ts` 검증
  - [ ] `bytesToHex`, `hexToBytes` 테스트

### 2차 작업 (오후)

- [ ] `remote.provider.ts` 개선
  - [ ] 타임아웃 처리
  - [ ] 재시도 로직 (옵션)
  - [ ] 에러 핸들링

- [ ] `hybrid.provider.ts` 개선
  - [ ] Primary 실패 시 Fallback 전환 로직
  - [ ] Circuit breaker 패턴 (옵션)

- [ ] 테스트 작성
  - [ ] `src/providers/local.provider.test.ts`
  - [ ] `src/providers/remote.provider.test.ts`

## 핵심 함수 시그니처

```typescript
// src/providers/index.ts

import type { SaltProvider, ProviderConfig } from '../types';

/**
 * 설정에 따라 적절한 Provider 생성
 */
export async function createProvider(config: ProviderConfig): Promise<SaltProvider>;
```

```typescript
// src/services/seed.service.ts

/**
 * HKDF를 사용해 salt 파생
 * @param masterSeed - 32바이트 마스터 시드
 * @param sub - JWT subject
 * @param aud - JWT audience
 * @returns 32바이트 salt
 */
export function deriveSalt(masterSeed: Uint8Array, sub: string, aud: string): Uint8Array;
```

## Salt 생성 알고리즘 (중요!)

```typescript
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

function deriveSalt(masterSeed: Uint8Array, sub: string, aud: string): Uint8Array {
  // 형식: "zklogin:{sub}:{aud}" 또는 "{sub}:{aud}"
  const info = new TextEncoder().encode(`${sub}:${aud}`);
  return hkdf(sha256, masterSeed, /* salt */ undefined, info, 32);
}
```

## 의존성

- `@noble/hashes` - HKDF, SHA256
- `src/types/index.ts` - 공통 타입

## 통합 포인트

Person C가 다음과 같이 호출:

```typescript
import { createProvider } from '../providers';
import type { SaltProvider } from '../types';

const provider: SaltProvider = await createProvider(config.provider);

// 사용
const salt = await provider.getSalt(claims.sub, claims.aud, jwt);
```

## 테스트 방법

```bash
# LocalProvider 테스트
npm run test -- src/providers/local.provider.test.ts

# 전체 Provider 테스트
npm run test -- src/providers/
```

## 주의사항

1. **시드 보안**: `masterSeed`는 절대 로그에 남기면 안 됨
2. **메모리 정리**: `destroy()` 호출 시 시드를 0으로 덮어쓰기
3. **결정론적**: 같은 (seed, sub, aud)는 항상 같은 salt 반환

## 참고 자료

- [@noble/hashes](https://github.com/paulmillr/noble-hashes)
- [HKDF RFC 5869](https://datatracker.ietf.org/doc/html/rfc5869)
- [Mysten Labs Salt Server](https://blog.sui.io/zklogin-salt-server-architecture/)
