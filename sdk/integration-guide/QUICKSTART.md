# ⚡ zkLogin 5분 빠른 시작

최소한의 코드로 zkLogin을 실제 앱에 통합하는 방법입니다.

## 백엔드 (Express)

```bash
npm install zklogin-salt-server express
```

```typescript
// server.js
import express from 'express';
import { createSaltRouter } from 'zklogin-salt-server/sdk/integrations/express';

const app = express();
app.use(express.json());

// zkLogin salt 엔드포인트 추가 (이게 전부!)
app.use('/api/zklogin', await createSaltRouter({
  provider: { type: 'mysten' }  // Mysten Labs 사용
}));

app.listen(3000, () => console.log('Server running on :3000'));
```

**완료!** 이제 `POST http://localhost:3000/api/zklogin/salt`에서 salt를 조회할 수 있습니다.

---

## 프론트엔드 (React)

```bash
npm install @mysten/sui
```

```typescript
// App.tsx
import { jwtToAddress } from '@mysten/sui/zklogin';

function App() {
  const handleLogin = async () => {
    // 1. Google OAuth로 리디렉션
    const clientId = 'YOUR_GOOGLE_CLIENT_ID';
    const redirectUri = 'http://localhost:5173/callback';
    const nonce = 'random-nonce'; // 실제로는 Ephemeral 키로 계산

    window.location.href =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${redirectUri}&` +
      `response_type=id_token&` +
      `scope=openid&` +
      `nonce=${nonce}`;
  };

  const handleCallback = async (jwt: string) => {
    // 2. Salt 조회
    const response = await fetch('http://localhost:3000/api/zklogin/salt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jwt })
    });
    const { salt } = await response.json();

    // 3. Sui 주소 계산
    const address = await jwtToAddress(jwt, salt);
    console.log('Your Sui address:', address);
  };

  return <button onClick={handleLogin}>Login with zkLogin</button>;
}
```

---

## 테스트

### 1. 백엔드 테스트

```bash
curl -X POST http://localhost:3000/api/zklogin/salt \
  -H "Content-Type: application/json" \
  -d '{"jwt": "YOUR_JWT_HERE"}'

# 응답:
# {"salt": "0x1234..."}
```

### 2. Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com/) → API & Services → Credentials
2. "Create Credentials" → "OAuth 2.0 Client ID"
3. Application type: **Web application**
4. Authorized redirect URIs: `http://localhost:5173/callback`
5. Client ID를 코드에 추가

---

## 프로덕션 준비

### 자체 Salt Server 사용

```typescript
// 백엔드
app.use('/api/zklogin', await createSaltRouter({
  provider: {
    type: 'local',
    seed: process.env.MASTER_SEED  // AWS Secrets Manager에서 로드
  }
}));
```

### 환경변수

```bash
# .env
MASTER_SEED=0x1234567890abcdef...  # npm run generate-seed로 생성
PORT=3000
```

---

## 다음 단계

### 완전한 플로우 구현

1. **Ephemeral 키 생성** → [utils.ts 참고](./utils.ts)
2. **ZK Proof 요청** → [README.md 참고](./README.md#완전한-예제)
3. **트랜잭션 서명** → [Sui 문서](https://docs.sui.io/concepts/cryptography/zklogin)

### 고급 기능

- **Hybrid 모드**: Primary + Fallback → [Hybrid 가이드](../../guides/hybrid/)
- **멀티테넌트**: 앱별 다른 provider → [Router 가이드](../../guides/router/)
- **AWS 배포**: EC2 + Secrets Manager → [Standalone 가이드](../../guides/standalone/)

---

## 문제 해결

### "Failed to get salt"

→ JWT가 유효한지 확인:
```bash
# JWT 디코딩 (jwt.io)
echo "YOUR_JWT" | base64 -d
```

### "CORS error"

→ 백엔드에 CORS 추가:
```typescript
import cors from 'cors';
app.use(cors({ origin: 'http://localhost:5173' }));
```

### "Invalid address"

→ JWT와 Salt가 일치하는지 확인:
```typescript
console.log('JWT:', jwt);
console.log('Salt:', salt);
```

---

## 더 알아보기

- **[완전한 통합 가이드](./README.md)** - 전체 플로우 및 프로덕션 배포
- **[Express + React 예제](./example-express-react/)** - 실행 가능한 완전한 예제
- **[Sui zkLogin 문서](https://docs.sui.io/concepts/cryptography/zklogin)** - zkLogin 개념 및 원리
