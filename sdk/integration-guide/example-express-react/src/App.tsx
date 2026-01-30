/**
 * React 프론트엔드 앱
 *
 * zkLogin 플로우를 데모하는 간단한 앱:
 * 1. OAuth 로그인 (Google)
 * 2. Salt 조회
 * 3. Sui 주소 계산
 */

import { useEffect, useState } from 'react';
import { jwtToAddress } from '@mysten/sui/zklogin';
import { generateEphemeralKeyPair, createOAuthURL, getSalt } from '../utils';

interface ZkLoginState {
  step: 'idle' | 'login' | 'processing' | 'success' | 'error';
  jwt: string | null;
  salt: string | null;
  address: string | null;
  error: string | null;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || 'http://localhost:5173/auth/callback';
const SALT_ENDPOINT = import.meta.env.VITE_SALT_ENDPOINT || 'http://localhost:3000/api/zklogin/salt';

function App() {
  const [state, setState] = useState<ZkLoginState>({
    step: 'idle',
    jwt: null,
    salt: null,
    address: null,
    error: null
  });

  useEffect(() => {
    // OAuth 콜백 처리
    const handleCallback = async () => {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const idToken = params.get('id_token');

      if (!idToken) return;

      setState(s => ({ ...s, step: 'processing', jwt: idToken }));

      try {
        // 1. Salt 조회
        const userSalt = await getSalt(idToken, SALT_ENDPOINT);

        // 2. Sui 주소 계산
        const zkAddress = await jwtToAddress(idToken, userSalt);

        setState(s => ({
          ...s,
          step: 'success',
          salt: userSalt,
          address: zkAddress
        }));

        // URL 정리
        window.history.replaceState({}, document.title, '/');

      } catch (error) {
        setState(s => ({
          ...s,
          step: 'error',
          error: error instanceof Error ? error.message : 'Failed to process login'
        }));
      }
    };

    handleCallback();
  }, []);

  const handleLogin = async () => {
    setState(s => ({ ...s, step: 'login', error: null }));

    try {
      // 1. Ephemeral key pair 생성
      const ephemeral = await generateEphemeralKeyPair();

      // 2. Session에 저장
      sessionStorage.setItem('zklogin_ephemeral', JSON.stringify({
        privateKey: ephemeral.keypair.getSecretKey(),
        maxEpoch: ephemeral.maxEpoch,
        randomness: ephemeral.randomness.toString()
      }));

      // 3. OAuth 리디렉션
      const oauthUrl = createOAuthURL(
        ephemeral.nonce,
        'google',
        GOOGLE_CLIENT_ID,
        REDIRECT_URI
      );

      window.location.href = oauthUrl;

    } catch (error) {
      setState(s => ({
        ...s,
        step: 'error',
        error: error instanceof Error ? error.message : 'Failed to start login'
      }));
    }
  };

  const handleReset = () => {
    sessionStorage.removeItem('zklogin_ephemeral');
    setState({
      step: 'idle',
      jwt: null,
      salt: null,
      address: null,
      error: null
    });
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🔐 zkLogin Demo</h1>
      <p style={{ color: '#666' }}>
        Sui zkLogin을 사용한 Web3 로그인 데모
      </p>

      <hr style={{ margin: '2rem 0' }} />

      {/* 에러 표시 */}
      {state.error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          <strong style={{ color: '#c00' }}>❌ Error:</strong> {state.error}
        </div>
      )}

      {/* 로딩 상태 */}
      {state.step === 'login' && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>🔄 OAuth 리디렉션 중...</p>
        </div>
      )}

      {state.step === 'processing' && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>🔄 Salt 조회 및 주소 계산 중...</p>
        </div>
      )}

      {/* 로그인 버튼 */}
      {state.step === 'idle' && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <button
            onClick={handleLogin}
            style={{
              padding: '1rem 2rem',
              fontSize: '1.1rem',
              backgroundColor: '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔑 Login with Google
          </button>

          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
            zkLogin을 사용하여 Google 계정으로 로그인합니다
          </p>
        </div>
      )}

      {/* 성공 결과 */}
      {state.step === 'success' && (
        <div>
          <h2 style={{ color: '#0a0' }}>✅ Login Success!</h2>

          <div style={{
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            backgroundColor: '#f5f5f5',
            padding: '1rem',
            borderRadius: '4px',
            marginTop: '1rem'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <strong>JWT Token:</strong>
              <div style={{
                marginTop: '0.5rem',
                wordBreak: 'break-all',
                color: '#666'
              }}>
                {state.jwt?.substring(0, 100)}...
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <strong>User Salt:</strong>
              <div style={{
                marginTop: '0.5rem',
                wordBreak: 'break-all',
                color: '#0066cc'
              }}>
                {state.salt}
              </div>
            </div>

            <div>
              <strong>Sui Address:</strong>
              <div style={{
                marginTop: '0.5rem',
                wordBreak: 'break-all',
                color: '#009900',
                fontWeight: 'bold'
              }}>
                {state.address}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <button
              onClick={handleReset}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔄 Reset
            </button>
          </div>

          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: '#e8f5e9',
            borderRadius: '4px'
          }}>
            <h3>✨ 다음 단계:</h3>
            <ol style={{ marginLeft: '1.5rem' }}>
              <li>ZK Proof 생성 (Mysten Labs Prover 사용)</li>
              <li>Ephemeral 키로 트랜잭션 서명</li>
              <li>Sui 네트워크에 트랜잭션 제출</li>
            </ol>
          </div>
        </div>
      )}

      {/* 설명 */}
      {state.step === 'idle' && (
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#f9f9f9',
          borderRadius: '4px'
        }}>
          <h3>📖 zkLogin 플로우:</h3>
          <ol style={{ marginLeft: '1.5rem', lineHeight: '1.8' }}>
            <li><strong>Ephemeral Key 생성:</strong> 임시 서명 키 생성 및 nonce 계산</li>
            <li><strong>OAuth 로그인:</strong> Google 계정으로 인증 (JWT 발급)</li>
            <li><strong>Salt 조회:</strong> Salt Server에서 사용자 salt 획득</li>
            <li><strong>주소 계산:</strong> JWT + Salt로 Sui 주소 생성</li>
            <li><strong>ZK Proof:</strong> zkLogin 증명 생성 (Prover 사용)</li>
            <li><strong>트랜잭션:</strong> Sui 네트워크에 트랜잭션 제출</li>
          </ol>
        </div>
      )}
    </div>
  );
}

export default App;
