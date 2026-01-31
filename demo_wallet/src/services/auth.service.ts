/**
 * Auth Service - handles OAuth flow and JWT management
 */

import { generateEphemeralKeyPair, createOAuthURL } from '../utils/zklogin.utils';
import { getExtendedEphemeralPublicKey } from '@mysten/sui/zklogin';

export class AuthService {
  private readonly clientId: string;
  private readonly redirectUri: string;

  constructor() {
    this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    this.redirectUri = import.meta.env.VITE_REDIRECT_URI;

    if (!this.clientId) {
      throw new Error('VITE_GOOGLE_CLIENT_ID is not defined in environment variables');
    }

    if (!this.redirectUri) {
      throw new Error('VITE_REDIRECT_URI is not defined in environment variables');
    }
  }

  /**
   * Initiate OAuth flow
   * - Generates ephemeral keys
   * - Computes nonce
   * - Redirects to Google OAuth
   */
  async initiateOAuthFlow(): Promise<void> {
    // 1. Generate ephemeral keys
    const { keypair, maxEpoch, randomness, nonce } =
      await generateEphemeralKeyPair();

    // 2. Get extended ephemeral public key for prover
    const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(keypair.getPublicKey());

    // 3. Save to sessionStorage
    sessionStorage.setItem('zklogin_ephemeral', JSON.stringify({
      privateKey: keypair.getSecretKey(),
      extendedEphemeralPublicKey,
      maxEpoch,
      randomness: randomness.toString()
    }));

    // 4. Redirect to Google OAuth
    const oauthUrl = createOAuthURL(
      nonce,
      'google',
      this.clientId,
      this.redirectUri
    );

    window.location.href = oauthUrl;
  }

  /**
   * Handle OAuth callback
   * Parses JWT from URL hash
   *
   * @returns JWT token or null
   */
  handleOAuthCallback(): string | null {
    // Parse JWT from URL hash (#id_token=...)
    const params = new URLSearchParams(window.location.hash.substring(1));
    return params.get('id_token');
  }

  /**
   * Basic JWT validation (checks format)
   *
   * @param jwt - JWT token
   * @returns true if valid format
   */
  validateJWT(jwt: string): boolean {
    const parts = jwt.split('.');
    return parts.length === 3;
  }
}
