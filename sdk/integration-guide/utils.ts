/**
 * zkLogin 통합을 위한 헬퍼 유틸리티 함수들
 *
 * 이 파일의 함수들은 프론트엔드에서 zkLogin 플로우를 구현할 때 사용됩니다.
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { genAddressSeed, computeZkLoginAddress } from '@mysten/sui/zklogin';
import { toBigEndianBytes } from '@mysten/sui/utils';
import { poseidonHash } from '@mysten/sui/utils';

/**
 * 랜덤 값 생성 (jwt_randomness)
 *
 * @returns 128비트 랜덤 BigInt
 */
export function generateRandomness(): bigint {
  const randomBytes = new Uint8Array(16); // 128 bits
  crypto.getRandomValues(randomBytes);

  let randomness = 0n;
  for (let i = 0; i < 16; i++) {
    randomness = (randomness << 8n) | BigInt(randomBytes[i]);
  }

  return randomness;
}

/**
 * Nonce 계산
 *
 * nonce = Base64URL(Poseidon([
 *   extended_eph_pk_bigint / 2^128,
 *   extended_eph_pk_bigint % 2^128,
 *   max_epoch,
 *   jwt_randomness
 * ]))
 *
 * @param ephemeralPublicKey - Ephemeral 공개키
 * @param maxEpoch - 최대 epoch
 * @param randomness - JWT randomness
 * @returns Base64URL 인코딩된 nonce
 */
export function computeNonce(
  ephemeralPublicKey: Uint8Array,
  maxEpoch: number,
  randomness: bigint
): string {
  // 공개키를 BigInt로 변환
  let pkBigInt = 0n;
  for (let i = 0; i < ephemeralPublicKey.length; i++) {
    pkBigInt = (pkBigInt << 8n) | BigInt(ephemeralPublicKey[i]);
  }

  // Poseidon 해시 계산
  const hash = poseidonHash([
    pkBigInt / (2n ** 128n),      // 상위 128비트
    pkBigInt % (2n ** 128n),      // 하위 128비트
    BigInt(maxEpoch),
    randomness
  ]);

  // Base64URL 인코딩
  return toBase64URL(toBigEndianBytes(hash, 32));
}

/**
 * Base64URL 인코딩
 *
 * @param data - 바이트 배열
 * @returns Base64URL 문자열
 */
function toBase64URL(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Ephemeral Key Pair 생성
 *
 * @param maxEpoch - 최대 epoch (선택, 기본: 현재 + 10)
 * @returns Ephemeral 키 정보
 */
export async function generateEphemeralKeyPair(maxEpoch?: number) {
  const keypair = new Ed25519Keypair();
  const randomness = generateRandomness();
  const epoch = maxEpoch ?? 10; // 실제로는 현재 epoch를 조회해야 함

  const publicKey = keypair.getPublicKey();
  const publicKeyBytes = publicKey.toBytes();

  const nonce = computeNonce(publicKeyBytes, epoch, randomness);

  return {
    keypair,
    ephemeralPublicKey: publicKeyBytes,
    maxEpoch: epoch,
    randomness,
    nonce
  };
}

/**
 * OAuth URL 생성
 *
 * @param nonce - 계산된 nonce
 * @param provider - OAuth 제공자
 * @param clientId - OAuth Client ID
 * @param redirectUri - Redirect URI
 * @returns OAuth 인증 URL
 */
export function createOAuthURL(
  nonce: string,
  provider: 'google' | 'facebook' | 'twitch' | 'apple',
  clientId: string,
  redirectUri: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email',
    nonce: nonce,
    state: generateState() // CSRF 보호
  });

  const baseUrls = {
    google: 'https://accounts.google.com/o/oauth2/v2/auth',
    facebook: 'https://www.facebook.com/v18.0/dialog/oauth',
    twitch: 'https://id.twitch.tv/oauth2/authorize',
    apple: 'https://appleid.apple.com/auth/authorize'
  };

  return `${baseUrls[provider]}?${params.toString()}`;
}

/**
 * CSRF 방지를 위한 state 생성
 *
 * @returns 랜덤 state 문자열
 */
function generateState(): string {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Salt 조회
 *
 * @param jwt - OAuth JWT 토큰
 * @param saltEndpoint - Salt Server 엔드포인트
 * @returns Salt 값
 */
export async function getSalt(
  jwt: string,
  saltEndpoint = 'http://localhost:3000/api/zklogin/salt'
): Promise<string> {
  const response = await fetch(saltEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jwt })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Salt request failed: ${response.statusText}`);
  }

  const { salt } = await response.json();
  return salt;
}

/**
 * ZK Proof 요청
 *
 * @param jwt - OAuth JWT 토큰
 * @param salt - User salt
 * @param ephemeralPublicKey - Ephemeral 공개키 (hex 문자열)
 * @param randomness - JWT randomness
 * @param maxEpoch - 최대 epoch
 * @param proverEndpoint - Prover 서비스 엔드포인트
 * @returns ZK Proof
 */
export async function getZKProof(
  jwt: string,
  salt: string,
  ephemeralPublicKey: string,
  randomness: string,
  maxEpoch: number,
  proverEndpoint = 'https://prover-dev.mystenlabs.com/v1'
): Promise<any> {
  const response = await fetch(proverEndpoint, {
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

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `ZK Proof request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Ephemeral 키 정보 저장
 *
 * @param data - 저장할 데이터
 */
export function saveEphemeralData(data: {
  privateKey: string;
  maxEpoch: number;
  randomness: string;
}): void {
  sessionStorage.setItem('zklogin_ephemeral', JSON.stringify(data));
}

/**
 * Ephemeral 키 정보 불러오기
 *
 * @returns 저장된 데이터 또는 null
 */
export function loadEphemeralData(): {
  privateKey: string;
  maxEpoch: number;
  randomness: string;
} | null {
  const data = sessionStorage.getItem('zklogin_ephemeral');
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Ephemeral 키 정보 삭제
 */
export function clearEphemeralData(): void {
  sessionStorage.removeItem('zklogin_ephemeral');
}

/**
 * JWT에서 claims 파싱
 *
 * @param jwt - JWT 토큰
 * @returns Decoded claims
 */
export function parseJWT(jwt: string): any {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    throw new Error(`Failed to parse JWT: ${error}`);
  }
}

/**
 * 현재 epoch 조회
 *
 * @param suiClient - Sui Client 인스턴스
 * @returns 현재 epoch
 */
export async function getCurrentEpoch(suiClient: any): Promise<number> {
  const epoch = await suiClient.getLatestSuiSystemState();
  return Number(epoch.epoch);
}

/**
 * zkLogin 주소 계산 (간편 버전)
 *
 * @param jwt - JWT 토큰
 * @param salt - User salt
 * @returns Sui 주소
 */
export async function computeAddress(jwt: string, salt: string): Promise<string> {
  const claims = parseJWT(jwt);
  const { sub, aud, iss } = claims;

  const addressSeed = genAddressSeed(
    BigInt(salt),
    'sub', // key claim name
    sub,   // key claim value
    aud    // audience
  );

  return computeZkLoginAddress({
    addressSeed: addressSeed.toString(),
    iss
  });
}
