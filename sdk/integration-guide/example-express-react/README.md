# Express + React zkLogin 예제

zkLogin Salt Server SDK를 사용한 완전한 예제 앱입니다.

## 기능

- ✅ Express 백엔드에 Salt Server 통합
- ✅ React 프론트엔드에서 OAuth 로그인
- ✅ Salt 조회 및 Sui 주소 계산
- ✅ 완전한 zkLogin 플로우 데모

## 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env` 파일 생성:

```bash
# 백엔드
PORT=3000
SALT_PROVIDER_TYPE=mysten  # 또는 local, custom
MASTER_SEED=0x...          # local 모드인 경우

# 프론트엔드 (Vite)
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_SALT_ENDPOINT=http://localhost:3000/api/zklogin/salt
```

### 3. Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. OAuth 2.0 Client ID 생성:
   - Application type: Web application
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:5173/auth/callback`
3. Client ID를 `.env`에 저장

### 4. 서버 실행

```bash
npm run dev
```

- 백엔드: http://localhost:3000
- 프론트엔드: http://localhost:5173

### 5. 테스트

1. 브라우저에서 http://localhost:5173 열기
2. "Login with Google" 버튼 클릭
3. Google 계정으로 로그인
4. Salt 및 Sui 주소 확인

## 프로젝트 구조

```
example-express-react/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
├── server/
│   └── index.ts          # Express 백엔드
└── src/
    ├── App.tsx           # React 프론트엔드
    ├── utils.ts          # zkLogin 헬퍼 함수
    └── main.tsx          # React 진입점
```

## API 엔드포인트

### POST /api/zklogin/salt

Salt 조회 API

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

**Error (400/500):**
```json
{
  "error": "invalid_jwt",
  "message": "JWT signature verification failed"
}
```

## Salt Provider 모드

### Mysten Labs (기본)

```bash
SALT_PROVIDER_TYPE=mysten
```

Mysten Labs의 공식 Salt Server를 프록시합니다.

### Local (자체 Seed)

```bash
SALT_PROVIDER_TYPE=local
MASTER_SEED=0x1234567890abcdef...
```

자체 Master Seed로 salt를 생성합니다.

### Custom (커스텀 서버)

```bash
SALT_PROVIDER_TYPE=custom
SALT_ENDPOINT=https://your-salt-server.com/v1/salt
```

커스텀 Salt Server를 사용합니다.

## 프로덕션 배포

### 백엔드

```bash
# 빌드
npm run build

# 환경변수 설정
export PORT=3000
export SALT_PROVIDER_TYPE=local
export MASTER_SEED=$(cat /path/to/seed.json | jq -r .masterSeed)

# 실행
node dist/server/index.js
```

### 프론트엔드

```bash
# 빌드
npm run build

# dist/ 디렉토리를 정적 호스팅 (Vercel, Netlify 등)
```

## 문제 해결

### CORS 에러

백엔드의 CORS 설정 확인:

```typescript
app.use(cors({
  origin: 'http://localhost:5173', // 프론트엔드 URL
  credentials: true
}));
```

### OAuth 리디렉션 실패

1. Google Cloud Console에서 Redirect URI 확인
2. `.env`의 `VITE_REDIRECT_URI` 확인
3. Client ID가 정확한지 확인

### Salt 조회 실패

1. 백엔드가 실행 중인지 확인: `curl http://localhost:3000/health`
2. JWT가 유효한지 확인
3. Salt Provider 설정 확인

## 참고 자료

- [통합 가이드](../README.md)
- [Express 통합 문서](../../../sdk/integrations/express.ts)
- [Sui zkLogin 문서](https://docs.sui.io/concepts/cryptography/zklogin)
