# zkLogin Salt Server 통합 가이드

실제 앱에서 zkLogin과 Salt Server를 통합하는 방법에 대한 완전한 가이드입니다.

> **빠른 시작**: 5분 안에 시작하고 싶으신가요? [⚡ QUICKSTART.md](./QUICKSTART.md)를 확인하세요!
> **요약 보기**: 전체 구조를 한눈에 보려면 [📊 SUMMARY.md](./SUMMARY.md)를 확인하세요!

## 📋 목차

- [zkLogin 플로우 개요](#zklogin-플로우-개요)
- [SDK Provider 타입 이해하기](#sdk-provider-타입-이해하기)
- [백엔드 통합](#백엔드-통합)
- [프론트엔드 통합](#프론트엔드-통합)
- [완전한 예제](#완전한-예제)
- [프로덕션 체크리스트](#프로덕션-체크리스트)

---

## zkLogin 플로우 개요

### 전체 인증 플로우

```
┌─────────────┐
│   1. 사용자  │
│  로그인 시작 │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  2. Ephemeral Key Pair 생성              │
│  - 임시 서명 키 생성                      │
│  - max_epoch, jwt_randomness 설정        │
│  - nonce 계산 (공개키 + 만료 + 랜덤)      │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  3. OAuth 로그인 (Google, Facebook 등)  │
│  - nonce를 state에 포함                 │
│  - OAuth provider로 리디렉션             │
│  - 사용자 인증                           │
│  - JWT 토큰 발급 (sub, aud, iss 포함)   │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  4. Salt 조회                           │
│  - JWT를 Salt Server로 전송              │
│  - user_salt = f(sub, aud, iss, seed)  │
│  - 결정론적 salt 반환                    │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  5. zkLogin 주소 계산                    │
│  - Blake2b(flag, iss_L, iss, addr_seed) │
│  - addr_seed = f(sub, aud, user_salt)   │
│  - 사용자의 Sui 주소 생성                 │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  6. ZK Proof 생성                       │
│  - Proving Service로 JWT + salt 전송    │
│  - nonce 유효성 증명                     │
│  - RSA 서명 검증                         │
│  - 주소 일관성 증명                       │
│  - ZK Proof 반환                        │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  7. 트랜잭션 서명 및 제출                 │
│  - Ephemeral 키로 트랜잭션 서명           │
│  - 서명 + ZK Proof + Inputs 제출        │
│  - Sui 네트워크에서 검증 및 실행          │
└─────────────────────────────────────────┘
```

### Salt Server의 역할

Salt Server는 **4단계**에서 핵심 역할을 합니다:

1. **JWT 검증**: OAuth provider의 서명 확인
2. **Salt 생성**: `HKDF(master_seed, sub + aud)` 계산
3. **결정론적 보장**: 동일한 사용자 = 동일한 salt = 동일한 Sui 주소
4. **프라이버시**: Web2 계정과 Sui 주소 연결 분리

---

## SDK Provider 타입 이해하기

SDK 통합 시 **어디서 Salt를 가져올지** 선택해야 합니다. 중요한 점은 **SDK 통합과 Salt Server 운영은 다른 레벨**이라는 것입니다.

### Provider 타입 비교

| 타입 | 사용 시기 | Salt Server 위치 | Seed 저장 위치 | 권장 |
|------|----------|-----------------|---------------|------|
| **mysten** | Mysten Labs 사용 | Mysten Labs 서버 | Mysten Labs 관리 | ✅ 빠른 시작 |
| **local** | 앱에서 직접 계산 | 앱 백엔드 내부 | 앱 환경변수 (위험!) | ⚠️ 비추천 |
| **custom** | 자체 Salt Server | 자체 EC2/서버 | AWS Secrets Manager / Vault | ✅ 프로덕션 |

### 아키텍처 레벨 구분

```
┌─────────────────────────────────────────────────────────────────┐
│ 레벨 1: 앱 개발 (SDK 통합)                                        │
│                                                                 │
│  React 앱 → Express 백엔드 (SDK 사용)                            │
│             └─ provider: { type: '???' }  ← 어디서 salt 가져올지 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 레벨 2: Salt Server 운영 (guides/standalone 등)                  │
│                                                                 │
│  Salt Server (EC2)                                              │
│    └─ AWS Secrets Manager / Vault  ← Seed 안전하게 저장          │
└─────────────────────────────────────────────────────────────────┘
```

### 타입별 상세 설명

#### 1. Mysten Labs (`type: 'mysten'`)

**언제 사용**:
- 빠르게 시작하고 싶을 때
- Salt Server 운영 부담을 피하고 싶을 때
- 개발/테스트 환경

**코드**:
```typescript
app.use('/api/zklogin', await createSaltRouter({
  provider: { type: 'mysten' }
}));
// → https://salt.api.mystenlabs.com/get_salt 호출
```

**장점**:
- ✅ 즉시 사용 가능
- ✅ 인프라 관리 불필요
- ✅ 고가용성 보장

**단점**:
- ❌ Mysten Labs에 JWT 전송 (프라이버시 제한)
- ❌ API 비용 발생 가능
- ❌ Mysten Labs 다운 시 서비스 중단

#### 2. Local (`type: 'local'`)

**언제 사용**:
- **권장하지 않음!** 보안상 위험

**코드**:
```typescript
app.use('/api/zklogin', await createSaltRouter({
  provider: {
    type: 'local',
    seed: process.env.MASTER_SEED  // ⚠️ 앱 환경변수에 seed 노출
  }
}));
// → 앱 서버에서 직접 salt 계산
```

**문제점**:
- ❌ **Master Seed가 앱 코드에 노출** (보안 위험)
- ❌ Seed 유출 시 모든 사용자 영향
- ❌ Secrets Manager/Vault 사용 불가

**올바른 대안**: `custom` 타입 사용!

#### 3. Custom (`type: 'custom'`)

**언제 사용**:
- 완전한 프라이버시 (Mysten Labs에 JWT 안 보냄)
- 자체 Salt Server 운영 (AWS Secrets Manager, Vault 사용)
- 규정 준수 (데이터 리전 제한)
- Salt 로직 커스터마이징

**아키텍처**:
```
┌─────────────────┐
│  React 앱        │
└────────┬────────┘
         │ JWT
         ▼
┌─────────────────────────┐
│  앱 백엔드 (Express)     │
│  + SDK custom 타입       │
└────────┬────────────────┘
         │ POST https://my-salt-server.com/v1/salt
         ▼
┌─────────────────────────────────┐  ← guides/standalone/03-aws-secrets로 구축!
│  자체 Salt Server (EC2)          │
│                                 │
│  ┌──────────────────┐           │
│  │ Salt Server 앱   │           │
│  │ (Standalone)     │           │
│  └────────┬─────────┘           │
│           │                     │
│           ▼                     │
│  ┌──────────────────┐           │
│  │ AWS Secrets      │           │  ← Master Seed 안전하게 저장
│  │ Manager          │           │
│  └──────────────────┘           │
└─────────────────────────────────┘
```

**구축 방법**:

**Step 1**: Salt Server 구축 ([guides/standalone](../../guides/standalone/) 참고)

```bash
# AWS Secrets Manager 사용
cd guides/standalone/03-aws-secrets
./deploy-to-ec2.sh

# 또는 HashiCorp Vault 사용
cd guides/standalone/04-vault
./deploy.sh

# 결과: https://my-salt-server.example.com 운영 중
# Seed는 AWS Secrets Manager에 안전하게 저장됨
```

**Step 2**: 앱 백엔드에서 SDK 사용

```typescript
// server.ts
import { createSaltRouter } from 'zklogin-salt-server/sdk/integrations/express';

app.use('/api/zklogin', await createSaltRouter({
  provider: {
    type: 'custom',
    endpoint: 'https://my-salt-server.example.com/v1/salt'
    // ↑ Step 1에서 구축한 Salt Server URL
  }
}));
```

**Step 3**: 프론트엔드에서 사용 (변경 없음!)

```typescript
// 프론트엔드 코드는 동일
const { salt } = await fetch('http://localhost:3000/api/zklogin/salt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jwt })
});
```

**장점**:
- ✅ 완전한 프라이버시 (JWT가 자체 서버로만)
- ✅ Secrets Manager/Vault로 Seed 안전하게 관리
- ✅ 고가용성 구성 가능 (Hybrid 모드)
- ✅ 커스터마이징 자유도

**단점**:
- ❌ Salt Server 운영 필요 (인프라 비용)
- ❌ 모니터링 및 유지보수 필요

### 시나리오별 추천

#### 시나리오 1: 스타트업 (MVP 개발)

```typescript
// Mysten Labs 사용 (빠른 시작)
provider: { type: 'mysten' }
```

**나중에 성장하면**: Custom으로 마이그레이션

#### 시나리오 2: 중소기업 (프로덕션)

```typescript
// 자체 Salt Server 구축 (AWS Secrets Manager)
provider: {
  type: 'custom',
  endpoint: 'https://salt.yourcompany.com/v1/salt'
}
```

**참고**: [Standalone 가이드](../../guides/standalone/03-aws-secrets/)

#### 시나리오 3: 대기업 (엔터프라이즈)

```typescript
// 자체 Salt Server + Hybrid 모드 (고가용성)
provider: {
  type: 'custom',
  endpoint: 'https://salt.yourcompany.com/v1/salt'
  // Salt Server 자체는 Hybrid 모드로 구성 (Primary + Mysten Fallback)
}
```

**참고**: [Hybrid 가이드](../../guides/hybrid/)

#### 시나리오 4: SaaS 플랫폼 (멀티테넌트)

```typescript
// Router 모드 Salt Server 사용
provider: {
  type: 'custom',
  endpoint: 'https://salt.yourcompany.com/v1/salt'
  // Salt Server는 Router 모드로 앱별 다른 provider 사용
}
```

**참고**: [Router 가이드](../../guides/router/)

### AWS Secrets Manager / Vault는 어디에?

**중요**: AWS Secrets Manager와 HashiCorp Vault는 **Salt Server 운영**에 사용됩니다!

```
SDK 통합 (앱 개발자)
  ↓
  provider: { type: 'custom', endpoint: 'https://...' }
  ↓
자체 Salt Server (Salt Server 관리자)
  ↓
  guides/standalone/03-aws-secrets 사용
  ↓
AWS Secrets Manager (Master Seed 저장)
```

**Salt Server 구축 가이드**:
- [AWS Secrets Manager 사용](../../guides/standalone/03-aws-secrets/)
- [HashiCorp Vault 사용](../../guides/standalone/04-vault/)
- [AWS Nitro Enclaves 사용](../../guides/standalone/05-nitro/) (최고 보안)

---

## 백엔드 통합

### 1. Express 통합

#### 설치

```bash
npm install zklogin-salt-server express
```

#### 기본 사용법

```typescript
import express from 'express';
import { createSaltRouter } from 'zklogin-salt-server/sdk/integrations/express';

const app = express();
app.use(express.json());

// Option 1: Mysten Labs 프록시
app.use('/zklogin', await createSaltRouter({
  provider: { type: 'mysten' }
}));

// Option 2: 자체 Salt Server
app.use('/zklogin', await createSaltRouter({
  provider: {
    type: 'local',
    seed: process.env.MASTER_SEED
  }
}));

// Option 3: 커스텀 Salt Server
app.use('/zklogin', await createSaltRouter({
  provider: {
    type: 'custom',
    endpoint: 'https://your-salt-server.com/v1/salt'
  }
}));

app.listen(3000);
```

**사용**: `POST http://localhost:3000/zklogin/salt`

#### 미들웨어 방식

```typescript
import { saltMiddleware } from 'zklogin-salt-server/sdk/integrations/express';

app.use(saltMiddleware({
  provider: { type: 'mysten' }
}));

app.post('/api/zklogin/get-salt', async (req, res) => {
  const { jwt } = req.body;

  try {
    const { salt } = await req.saltClient.getSalt(jwt);
    res.json({ salt });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### 2. Fastify 통합

#### 설치

```bash
npm install zklogin-salt-server fastify
```

#### 기본 사용법

```typescript
import Fastify from 'fastify';
import { saltPlugin } from 'zklogin-salt-server/sdk/integrations/fastify';

const fastify = Fastify();

// Salt 엔드포인트 추가
await fastify.register(saltPlugin, {
  provider: { type: 'mysten' },
  prefix: '/zklogin'  // 선택사항
});

await fastify.listen({ port: 3000 });
```

**사용**: `POST http://localhost:3000/zklogin/salt`

#### 클라이언트 데코레이터 방식

```typescript
import { saltClientPlugin } from 'zklogin-salt-server/sdk/integrations/fastify';

await fastify.register(saltClientPlugin, {
  provider: { type: 'mysten' }
});

fastify.post('/api/zklogin/get-salt', async (request, reply) => {
  const { jwt } = request.body;

  const { salt } = await request.saltClient.getSalt(jwt);
  return { salt };
});
```

### 3. Hono 통합

#### 설치

```bash
npm install zklogin-salt-server hono
```

#### 기본 사용법

```typescript
import { Hono } from 'hono';
import { createSaltApp } from 'zklogin-salt-server/sdk/integrations/hono';

const app = new Hono();

// Salt 앱을 라우트로 추가
app.route('/zklogin', createSaltApp({
  provider: { type: 'mysten' }
}));

export default app;
```

**사용**: `POST http://localhost:3000/zklogin/salt`

---

## 프론트엔드 통합

### 1. 완전한 zkLogin 클라이언트 플로우

```typescript
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { genAddressSeed, getZkLoginSignature } from '@mysten/sui/zklogin';
import { jwtToAddress } from '@mysten/sui/zklogin';

// 1. Ephemeral Key Pair 생성
async function generateEphemeralKeyPair() {
  const keypair = new Ed25519Keypair();
  const maxEpoch = 10; // 현재 epoch + 10
  const randomness = generateRandomness();

  return {
    keypair,
    maxEpoch,
    randomness,
    ephemeralPublicKey: keypair.getPublicKey()
  };
}

// 2. OAuth 로그인 URL 생성
function createOAuthURL(nonce: string, provider: 'google' | 'facebook') {
  const redirectUri = 'https://yourapp.com/auth/callback';
  const clientId = 'YOUR_CLIENT_ID';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email',
    nonce: nonce,
    state: 'random-state'
  });

  if (provider === 'google') {
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  } else if (provider === 'facebook') {
    return `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
  }
}

// 3. Salt 조회
async function getSalt(jwt: string): Promise<string> {
  const response = await fetch('http://localhost:3000/zklogin/salt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jwt })
  });

  if (!response.ok) {
    throw new Error(`Salt request failed: ${response.statusText}`);
  }

  const { salt } = await response.json();
  return salt;
}

// 4. zkLogin 주소 계산
async function getZkLoginAddress(jwt: string, salt: string): Promise<string> {
  return jwtToAddress(jwt, salt);
}

// 5. ZK Proof 요청
async function getZKProof(
  jwt: string,
  salt: string,
  ephemeralPublicKey: string,
  randomness: string,
  maxEpoch: number
): Promise<any> {
  const response = await fetch('https://prover-dev.mystenlabs.com/v1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jwt,
      extendedEphemeralPublicKey: ephemeralPublicKey,
      maxEpoch: maxEpoch.toString(),
      jwtRandomness: randomness,
      salt,
      keyClaimName: 'sub'
    })
  });

  return response.json();
}

// 6. 트랜잭션 서명 및 제출
async function signAndExecuteTransaction(
  transaction: any,
  ephemeralKeypair: Ed25519Keypair,
  zkProof: any,
  userSignature: string
) {
  const client = new SuiClient({ url: getFullnodeUrl('devnet') });

  const zkLoginSignature = getZkLoginSignature({
    inputs: zkProof,
    maxEpoch: zkProof.maxEpoch,
    userSignature
  });

  return client.executeTransactionBlock({
    transactionBlock: transaction,
    signature: zkLoginSignature
  });
}
```

### 2. React 예제

```typescript
import { useState, useEffect } from 'react';

function ZkLoginDemo() {
  const [jwt, setJwt] = useState<string | null>(null);
  const [salt, setSalt] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  // OAuth 로그인 시작
  const handleLogin = async () => {
    const { keypair, maxEpoch, randomness, ephemeralPublicKey } =
      await generateEphemeralKeyPair();

    // Ephemeral 키 저장 (세션 스토리지)
    sessionStorage.setItem('ephemeral', JSON.stringify({
      privateKey: keypair.export().privateKey,
      maxEpoch,
      randomness
    }));

    // nonce 계산
    const nonce = computeNonce(ephemeralPublicKey, maxEpoch, randomness);

    // OAuth 리디렉션
    window.location.href = createOAuthURL(nonce, 'google');
  };

  // OAuth 콜백 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const idToken = params.get('id_token');

    if (idToken) {
      setJwt(idToken);
      fetchSaltAndAddress(idToken);
    }
  }, []);

  const fetchSaltAndAddress = async (jwt: string) => {
    // Salt 조회
    const userSalt = await getSalt(jwt);
    setSalt(userSalt);

    // 주소 계산
    const zkAddress = await getZkLoginAddress(jwt, userSalt);
    setAddress(zkAddress);
  };

  return (
    <div>
      <h1>zkLogin Demo</h1>

      {!jwt ? (
        <button onClick={handleLogin}>
          Login with Google
        </button>
      ) : (
        <div>
          <p>JWT: {jwt.substring(0, 50)}...</p>
          <p>Salt: {salt}</p>
          <p>Sui Address: {address}</p>
        </div>
      )}
    </div>
  );
}
```

### 3. Vue 예제

```vue
<template>
  <div>
    <h1>zkLogin Demo</h1>

    <button v-if="!jwt" @click="handleLogin">
      Login with Google
    </button>

    <div v-else>
      <p>JWT: {{ jwt.substring(0, 50) }}...</p>
      <p>Salt: {{ salt }}</p>
      <p>Sui Address: {{ address }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const jwt = ref<string | null>(null);
const salt = ref<string | null>(null);
const address = ref<string | null>(null);

const handleLogin = async () => {
  const { keypair, maxEpoch, randomness, ephemeralPublicKey } =
    await generateEphemeralKeyPair();

  sessionStorage.setItem('ephemeral', JSON.stringify({
    privateKey: keypair.export().privateKey,
    maxEpoch,
    randomness
  }));

  const nonce = computeNonce(ephemeralPublicKey, maxEpoch, randomness);
  window.location.href = createOAuthURL(nonce, 'google');
};

onMounted(async () => {
  const params = new URLSearchParams(window.location.hash.substring(1));
  const idToken = params.get('id_token');

  if (idToken) {
    jwt.value = idToken;

    const userSalt = await getSalt(idToken);
    salt.value = userSalt;

    const zkAddress = await getZkLoginAddress(idToken, userSalt);
    address.value = zkAddress;
  }
});
</script>
```

---

## 완전한 예제

### Express + React 완전한 앱

#### 백엔드 (Express)

```typescript
// server.ts
import express from 'express';
import cors from 'cors';
import { createSaltRouter } from 'zklogin-salt-server/sdk/integrations/express';

const app = express();

app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server
  credentials: true
}));
app.use(express.json());

// zkLogin salt 엔드포인트
app.use('/api/zklogin', await createSaltRouter({
  provider: {
    type: 'local',
    seed: process.env.MASTER_SEED || '0x' + '1'.repeat(64)
  }
}));

// 헬스체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

#### 프론트엔드 (React + Vite)

```typescript
// src/hooks/useZkLogin.ts
import { useState } from 'react';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { jwtToAddress } from '@mysten/sui/zklogin';

interface ZkLoginState {
  jwt: string | null;
  salt: string | null;
  address: string | null;
  loading: boolean;
  error: string | null;
}

export function useZkLogin() {
  const [state, setState] = useState<ZkLoginState>({
    jwt: null,
    salt: null,
    address: null,
    loading: false,
    error: null
  });

  const login = async (provider: 'google' | 'facebook') => {
    setState(s => ({ ...s, loading: true, error: null }));

    try {
      // 1. Ephemeral key 생성
      const keypair = new Ed25519Keypair();
      const maxEpoch = 10;
      const randomness = generateRandomness();

      // 2. 세션에 저장
      sessionStorage.setItem('ephemeral', JSON.stringify({
        privateKey: keypair.export().privateKey,
        maxEpoch,
        randomness
      }));

      // 3. OAuth 리디렉션
      const nonce = computeNonce(
        keypair.getPublicKey(),
        maxEpoch,
        randomness
      );

      const oauthUrl = createOAuthURL(nonce, provider);
      window.location.href = oauthUrl;

    } catch (error) {
      setState(s => ({
        ...s,
        loading: false,
        error: error instanceof Error ? error.message : 'Login failed'
      }));
    }
  };

  const handleCallback = async (jwt: string) => {
    setState(s => ({ ...s, loading: true, error: null }));

    try {
      // 1. Salt 조회
      const response = await fetch('http://localhost:3000/api/zklogin/salt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jwt })
      });

      if (!response.ok) {
        throw new Error('Failed to get salt');
      }

      const { salt } = await response.json();

      // 2. 주소 계산
      const address = await jwtToAddress(jwt, salt);

      setState({
        jwt,
        salt,
        address,
        loading: false,
        error: null
      });

    } catch (error) {
      setState(s => ({
        ...s,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to process JWT'
      }));
    }
  };

  return { state, login, handleCallback };
}
```

```tsx
// src/App.tsx
import { useEffect } from 'react';
import { useZkLogin } from './hooks/useZkLogin';

function App() {
  const { state, login, handleCallback } = useZkLogin();

  useEffect(() => {
    // OAuth 콜백 처리
    const params = new URLSearchParams(window.location.hash.substring(1));
    const idToken = params.get('id_token');

    if (idToken) {
      handleCallback(idToken);
    }
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h1>zkLogin Demo</h1>

      {state.loading && <p>Loading...</p>}
      {state.error && <p style={{ color: 'red' }}>{state.error}</p>}

      {!state.jwt ? (
        <div>
          <button onClick={() => login('google')}>
            Login with Google
          </button>
          <button onClick={() => login('facebook')} style={{ marginLeft: '1rem' }}>
            Login with Facebook
          </button>
        </div>
      ) : (
        <div>
          <h2>Login Success!</h2>
          <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
            <p><strong>JWT:</strong><br />{state.jwt.substring(0, 100)}...</p>
            <p><strong>Salt:</strong><br />{state.salt}</p>
            <p><strong>Sui Address:</strong><br />{state.address}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
```

#### package.json

```json
{
  "name": "zklogin-demo",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "dev": "concurrently \"npm run server\" \"npm run client\"",
    "server": "tsx watch server.ts",
    "client": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "@mysten/sui": "^1.0.0",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zklogin-salt-server": "^1.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/react": "^18.2.43",
    "@vitejs/plugin-react": "^4.2.1",
    "concurrently": "^8.2.2",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vite": "^5.0.8"
  }
}
```

---

## 프로덕션 체크리스트

### 백엔드

- [ ] **Salt Server 모드 선택**
  - [ ] Standalone: 완전 독립 (AWS Secrets Manager/Vault 사용)
  - [ ] Hybrid: Primary + Mysten Labs Fallback
  - [ ] Router: 멀티테넌트 지원

- [ ] **보안 설정**
  - [ ] Master Seed를 환경변수/평문으로 저장하지 않음
  - [ ] AWS Secrets Manager 또는 HashiCorp Vault 사용
  - [ ] IAM/ACL로 시크릿 접근 제어
  - [ ] HTTPS/TLS 필수
  - [ ] Rate limiting 활성화
  - [ ] CORS 오리진 제한

- [ ] **모니터링**
  - [ ] Salt 요청 성공률 메트릭
  - [ ] JWT 검증 실패 로그
  - [ ] Provider health check
  - [ ] 경보 설정 (Fallback 사용 시)

- [ ] **고가용성**
  - [ ] Hybrid 모드로 Fallback 설정
  - [ ] 멀티 리전 배포
  - [ ] Load Balancer 설정
  - [ ] Auto Scaling

### 프론트엔드

- [ ] **OAuth 설정**
  - [ ] 프로덕션 OAuth Client ID/Secret
  - [ ] Redirect URI 화이트리스트 등록
  - [ ] Scope 최소화 (`openid email`만)

- [ ] **보안**
  - [ ] JWT를 localStorage에 저장하지 않음 (세션/메모리만)
  - [ ] Ephemeral 키를 sessionStorage에 안전하게 저장
  - [ ] HTTPS 필수
  - [ ] CSP (Content Security Policy) 설정

- [ ] **사용자 경험**
  - [ ] 로딩 상태 표시
  - [ ] 에러 메시지 사용자 친화적으로
  - [ ] OAuth 콜백 타임아웃 처리
  - [ ] 네트워크 오류 재시도

- [ ] **성능**
  - [ ] Salt 조회 결과 캐싱 (동일 JWT)
  - [ ] ZK Proof 요청 병렬 처리
  - [ ] 트랜잭션 배치 처리

### 테스트

- [ ] **단위 테스트**
  - [ ] Salt 생성 로직
  - [ ] JWT 검증 로직
  - [ ] 주소 계산 로직

- [ ] **통합 테스트**
  - [ ] OAuth → Salt → 주소 계산 플로우
  - [ ] ZK Proof 생성 및 검증
  - [ ] 트랜잭션 서명 및 제출

- [ ] **부하 테스트**
  - [ ] Salt Server 처리량 (TPS)
  - [ ] Concurrent 요청 처리
  - [ ] Fallback 전환 시간

---

## 참고 자료

### 공식 문서
- [Sui zkLogin 문서](https://docs.sui.io/concepts/cryptography/zklogin)
- [Mysten Labs Salt Server](https://blog.sui.io/zklogin-salt-server-architecture/)
- [@mysten/sui SDK](https://sdk.mystenlabs.com/)

### 예제 코드
- [Sui zkLogin Example](https://github.com/MystenLabs/sui/tree/main/sdk/zklogin)
- [zkLogin Demo App](https://zklogin.io/)

### 관련 가이드
- [Standalone 모드](../../guides/standalone/)
- [Proxy 모드](../../guides/proxy/)
- [Hybrid 모드](../../guides/hybrid/)
- [Router 모드](../../guides/router/)

---

## 문의 및 지원

- **Issues**: [GitHub Issues](https://github.com/your-org/zklogin-salt-server/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/zklogin-salt-server/discussions)
