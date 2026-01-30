/**
 * zkLogin 헬퍼 유틸리티
 *
 * 이 파일은 guides/integration/utils.ts의 간소화 버전입니다.
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

export function generateRandomness(): bigint {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);

  let randomness = 0n;
  for (let i = 0; i < 16; i++) {
    randomness = (randomness << 8n) | BigInt(randomBytes[i]);
  }
  return randomness;
}

export function computeNonce(
  ephemeralPublicKey: Uint8Array,
  maxEpoch: number,
  randomness: bigint
): string {
  // 실제 구현은 Poseidon 해시를 사용해야 하지만,
  // 데모용으로 간소화된 버전을 사용합니다.
  // 프로덕션에서는 @mysten/sui의 공식 구현을 사용하세요.

  const data = new TextEncoder().encode(
    `${Array.from(ephemeralPublicKey).join(',')}-${maxEpoch}-${randomness}`
  );

  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function generateEphemeralKeyPair(maxEpoch = 10) {
  const keypair = new Ed25519Keypair();
  const randomness = generateRandomness();
  const publicKey = keypair.getPublicKey();
  const publicKeyBytes = publicKey.toBytes();
  const nonce = computeNonce(publicKeyBytes, maxEpoch, randomness);

  return {
    keypair,
    ephemeralPublicKey: publicKeyBytes,
    maxEpoch,
    randomness,
    nonce
  };
}

export function createOAuthURL(
  nonce: string,
  provider: 'google',
  clientId: string,
  redirectUri: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email',
    nonce: nonce,
    state: Math.random().toString(36).substring(7)
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function getSalt(
  jwt: string,
  saltEndpoint: string
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
