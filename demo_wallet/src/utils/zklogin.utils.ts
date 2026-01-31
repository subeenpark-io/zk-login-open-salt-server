/**
 * zkLogin integration helper utilities
 *
 * Based on sdk/integration-guide/utils.ts
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { PublicKey } from '@mysten/sui/cryptography';
import { SuiClient } from '@mysten/sui/client';
import { computeZkLoginAddress, generateNonce, generateRandomness as genRandomness } from '@mysten/sui/zklogin';

/**
 * Generate randomness for JWT (jwt_randomness)
 * Uses SDK's built-in function
 *
 * @returns 128-bit random string
 */
export function generateRandomness(): string {
  return genRandomness();
}

/**
 * Compute nonce using SDK's built-in function
 *
 * @param ephemeralPublicKey - Ephemeral public key (PublicKey object)
 * @param maxEpoch - Maximum epoch
 * @param randomness - JWT randomness
 * @returns Base64URL encoded nonce
 */
export function computeNonce(
  ephemeralPublicKey: PublicKey,
  maxEpoch: number,
  randomness: string | bigint
): string {
  return generateNonce(ephemeralPublicKey, maxEpoch, randomness);
}

/**
 * Get current epoch from Sui network
 *
 * @returns Current epoch number
 */
export async function getCurrentEpoch(): Promise<number> {
  const rpcUrl = import.meta.env.VITE_SUI_RPC_URL || 'https://fullnode.devnet.sui.io';
  const client = new SuiClient({ url: rpcUrl });
  const { epoch } = await client.getLatestSuiSystemState();
  return Number(epoch);
}

/**
 * Generate ephemeral key pair
 *
 * @param epochOffset - Number of epochs to add to current epoch (default: 10)
 * @returns Ephemeral key information
 */
export async function generateEphemeralKeyPair(epochOffset: number = 10) {
  const keypair = new Ed25519Keypair();
  const randomness = generateRandomness();

  // Fetch current epoch from Sui network and add offset
  const currentEpoch = await getCurrentEpoch();
  const maxEpoch = currentEpoch + epochOffset;

  const publicKey = keypair.getPublicKey();
  const publicKeyBytes = publicKey.toRawBytes();

  // SDK's generateNonce expects PublicKey object, not Uint8Array
  const nonce = generateNonce(publicKey, maxEpoch, randomness);

  return {
    keypair,
    ephemeralPublicKey: publicKeyBytes,
    maxEpoch,
    randomness,
    nonce
  };
}

/**
 * Create OAuth URL
 *
 * @param nonce - Computed nonce
 * @param provider - OAuth provider
 * @param clientId - OAuth Client ID
 * @param redirectUri - Redirect URI
 * @returns OAuth authentication URL
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
    state: generateState(), // CSRF protection
    prompt: 'select_account' // Force account selection to avoid caching issues
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
 * Generate state for CSRF protection
 *
 * @returns Random state string
 */
function generateState(): string {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Fetch salt from Salt Server
 *
 * @param jwt - OAuth JWT token
 * @param saltEndpoint - Salt Server endpoint
 * @returns Salt value
 */
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

/**
 * Request ZK Proof from Mysten Prover
 *
 * @param jwt - OAuth JWT token
 * @param salt - User salt
 * @param ephemeralPublicKey - Ephemeral public key (hex string)
 * @param randomness - JWT randomness
 * @param maxEpoch - Maximum epoch
 * @param proverEndpoint - Prover service endpoint
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
 * Save ephemeral data to sessionStorage
 *
 * @param data - Data to save
 */
export function saveEphemeralData(data: {
  privateKey: string;
  maxEpoch: number;
  randomness: string;
}): void {
  sessionStorage.setItem('zklogin_ephemeral', JSON.stringify(data));
}

/**
 * Load ephemeral data from sessionStorage
 *
 * @returns Stored data or null
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
 * Clear ephemeral data from sessionStorage
 */
export function clearEphemeralData(): void {
  sessionStorage.removeItem('zklogin_ephemeral');
}

/**
 * Parse JWT claims
 *
 * @param jwt - JWT token
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
 * Compute zkLogin address (simplified version)
 *
 * @param jwt - JWT token
 * @param salt - User salt
 * @returns Sui address
 */
export async function computeAddress(jwt: string, salt: string): Promise<string> {
  const claims = parseJWT(jwt);
  const { sub, aud, iss } = claims;

  return computeZkLoginAddress({
    claimName: 'sub',
    claimValue: sub,
    userSalt: salt,
    iss,
    aud
  });
}
