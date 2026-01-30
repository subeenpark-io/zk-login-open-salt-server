# zkLogin Salt Server 통합 가이드 요약

## 📦 생성된 파일 구조

```
guides/integration/
├── README.md                           # 메인 통합 가이드
├── SUMMARY.md                          # 이 파일
├── utils.ts                            # zkLogin 헬퍼 함수들
└── example-express-react/              # 완전한 예제 프로젝트
    ├── README.md                       # 예제 사용법
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts
    ├── .env.example
    ├── .gitignore
    ├── index.html
    ├── server/
    │   └── index.ts                    # Express 백엔드
    └── src/
        ├── main.tsx                    # React 진입점
        ├── App.tsx                     # React 앱
        └── utils.ts                    # 프론트엔드 헬퍼
```

## 📚 가이드 내용

### 1. README.md - 메인 통합 가이드

**섹션**:
- zkLogin 플로우 개요 (7단계 상세 설명)
- 백엔드 통합 (Express, Fastify, Hono)
- 프론트엔드 통합 (React, Vue 예제)
- 완전한 예제 (Express + React)
- 프로덕션 체크리스트

**핵심 내용**:
```typescript
// 백엔드 (Express)
import { createSaltRouter } from 'zklogin-salt-server/sdk/integrations/express';
app.use('/api/zklogin', await createSaltRouter({
  provider: { type: 'mysten' }
}));

// 프론트엔드 (React)
const { salt } = await getSalt(jwt);
const address = await jwtToAddress(jwt, salt);
```

### 2. utils.ts - 헬퍼 유틸리티

**제공 함수**:

| 함수 | 설명 | 사용 예시 |
|------|------|-----------|
| `generateRandomness()` | JWT randomness 생성 | `const r = generateRandomness()` |
| `computeNonce()` | Poseidon 해시로 nonce 계산 | `const nonce = computeNonce(pk, epoch, r)` |
| `generateEphemeralKeyPair()` | Ephemeral 키 생성 | `const eph = await generateEphemeralKeyPair()` |
| `createOAuthURL()` | OAuth 인증 URL 생성 | `const url = createOAuthURL(nonce, 'google', clientId, redirect)` |
| `getSalt()` | Salt Server에서 salt 조회 | `const salt = await getSalt(jwt, endpoint)` |
| `getZKProof()` | ZK Proof 요청 | `const proof = await getZKProof(jwt, salt, pk, r, epoch)` |
| `saveEphemeralData()` | Ephemeral 키 저장 | `saveEphemeralData({ privateKey, maxEpoch, randomness })` |
| `loadEphemeralData()` | Ephemeral 키 불러오기 | `const data = loadEphemeralData()` |
| `parseJWT()` | JWT claims 파싱 | `const { sub, aud, iss } = parseJWT(jwt)` |
| `computeAddress()` | zkLogin 주소 계산 | `const addr = await computeAddress(jwt, salt)` |

### 3. example-express-react/ - 완전한 예제

**백엔드 (server/index.ts)**:
- Express 서버
- CORS 설정
- `/api/zklogin/salt` 엔드포인트
- Health check 엔드포인트
- 에러 핸들링

**프론트엔드 (src/App.tsx)**:
- OAuth 로그인 버튼
- 콜백 처리
- Salt 조회
- Sui 주소 계산
- 결과 표시
- 에러 처리

**실행 방법**:
```bash
cd guides/integration/example-express-react
npm install
cp .env.example .env
# .env 편집 (Google Client ID 설정)
npm run dev
```

## 🔗 SDK 통합 지원

### Express

```typescript
import { createSaltRouter, saltMiddleware } from 'zklogin-salt-server/sdk/integrations/express';

// Option 1: Router
app.use('/zklogin', await createSaltRouter({ provider: { type: 'mysten' } }));

// Option 2: Middleware
app.use(saltMiddleware({ provider: { type: 'mysten' } }));
app.post('/custom', async (req, res) => {
  const { salt } = await req.saltClient.getSalt(jwt);
});
```

### Fastify

```typescript
import { saltPlugin, saltClientPlugin } from 'zklogin-salt-server/sdk/integrations/fastify';

// Option 1: Plugin
await fastify.register(saltPlugin, {
  provider: { type: 'mysten' },
  prefix: '/zklogin'
});

// Option 2: Client Plugin
await fastify.register(saltClientPlugin, { provider: { type: 'mysten' } });
fastify.post('/custom', async (request, reply) => {
  const { salt } = await request.saltClient.getSalt(jwt);
});
```

### Hono

```typescript
import { createSaltApp } from 'zklogin-salt-server/sdk/integrations/hono';

const app = new Hono();
app.route('/zklogin', createSaltApp({ provider: { type: 'mysten' } }));
```

## 🎯 완전한 zkLogin 플로우

```
1. Frontend: Ephemeral Key 생성
   ↓
2. Frontend: OAuth 로그인 (Google/Facebook 등)
   ↓
3. OAuth Provider: JWT 발급
   ↓
4. Frontend → Backend: JWT 전송
   ↓
5. Backend → Salt Server: Salt 조회
   ↓
6. Backend → Frontend: Salt 반환
   ↓
7. Frontend: zkLogin 주소 계산
   ↓
8. Frontend → Prover: ZK Proof 요청
   ↓
9. Prover → Frontend: ZK Proof 반환
   ↓
10. Frontend: Ephemeral 키로 트랜잭션 서명
   ↓
11. Frontend → Sui Network: 트랜잭션 제출 (서명 + ZK Proof)
```

## 📋 프로덕션 체크리스트

### 백엔드

- [ ] Salt Server 모드 선택 (Standalone/Hybrid/Router)
- [ ] Secrets Manager 사용 (AWS/Vault)
- [ ] HTTPS/TLS 설정
- [ ] Rate limiting 활성화
- [ ] CORS 오리진 제한
- [ ] 모니터링 및 로깅
- [ ] Health check 엔드포인트

### 프론트엔드

- [ ] 프로덕션 OAuth Client ID
- [ ] Redirect URI 화이트리스트
- [ ] JWT를 localStorage에 저장하지 않기
- [ ] HTTPS 필수
- [ ] 에러 처리 및 재시도
- [ ] 로딩 상태 표시

### 테스트

- [ ] 단위 테스트 (Salt 생성, JWT 검증)
- [ ] 통합 테스트 (OAuth → Salt → 주소)
- [ ] 부하 테스트 (TPS, Concurrent)
- [ ] 보안 테스트 (JWT 위변조, CSRF)

## 🔗 관련 문서

- [메인 가이드](../README.md)
- [Standalone 모드](../../guides/standalone/)
- [Proxy 모드](../../guides/proxy/)
- [Hybrid 모드](../../guides/hybrid/)
- [Router 모드](../../guides/router/)
- [Sui zkLogin 문서](https://docs.sui.io/concepts/cryptography/zklogin)

## 💡 다음 단계

1. **예제 실행**: `example-express-react/` 디렉토리에서 예제 실행
2. **커스터마이징**: 자신의 앱에 맞게 수정
3. **프로덕션 배포**: 체크리스트 확인 후 배포
4. **모니터링**: Salt 요청 성공률 및 성능 모니터링
5. **스케일링**: 트래픽 증가 시 Hybrid/Router 모드로 전환

## 🆘 문제 해결

### "CORS 에러"
→ 백엔드 CORS 설정 확인

### "OAuth 리디렉션 실패"
→ Google Cloud Console에서 Redirect URI 확인

### "Salt 조회 실패"
→ 백엔드 health check 확인 (`/health`)

### "주소 계산 오류"
→ JWT와 Salt가 올바른지 확인

## 📊 성능 지표

| 항목 | 목표 | 측정 방법 |
|------|------|-----------|
| Salt 응답 시간 | < 100ms | `/api/zklogin/salt` 호출 시간 |
| OAuth 리디렉션 | < 2초 | 로그인 버튼 → OAuth 페이지 |
| ZK Proof 생성 | < 5초 | Prover API 호출 시간 |
| 전체 플로우 | < 10초 | 로그인 시작 → Sui 주소 획득 |

---

**마지막 업데이트**: 2024-01-31
