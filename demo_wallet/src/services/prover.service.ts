/**
 * Prover Service - handles ZK Proof generation via Mysten Labs Prover
 */

import type { ZkProof, ZkProofParams } from '../types/zklogin.types';

export class ProverService {
  private readonly endpoint: string;

  constructor() {
    this.endpoint = import.meta.env.VITE_PROVER_URL;

    if (!this.endpoint) {
      throw new Error('VITE_PROVER_URL is not defined in environment variables');
    }
  }

  /**
   * Generate ZK Proof from Mysten Prover
   *
   * @param params - ZK proof parameters
   * @returns ZK Proof
   */
  async generateZkProof(params: ZkProofParams): Promise<ZkProof> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jwt: params.jwt,
          extendedEphemeralPublicKey: params.ephemeralPublicKey,
          maxEpoch: params.maxEpoch.toString(),
          jwtRandomness: params.randomness,
          salt: params.salt,
          keyClaimName: 'sub'
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.message || `ZK Proof generation failed: ${response.statusText}`
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to generate ZK Proof');
    }
  }

  /**
   * Cache proof in sessionStorage
   *
   * @param proof - ZK Proof to cache
   */
  cacheProof(proof: ZkProof): void {
    sessionStorage.setItem('zklogin_proof', JSON.stringify(proof));
  }

  /**
   * Load cached proof from sessionStorage
   *
   * @returns Cached proof or null
   */
  loadCachedProof(): ZkProof | null {
    const data = sessionStorage.getItem('zklogin_proof');
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Clear cached proof
   */
  clearCachedProof(): void {
    sessionStorage.removeItem('zklogin_proof');
  }
}
