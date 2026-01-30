/**
 * Wallet state type definitions
 */

import type { ZkProof } from './zklogin.types';

export interface WalletState {
  // Auth
  isAuthenticated: boolean;
  jwt: string | null;

  // zkLogin Data
  salt: string | null;
  zkAddress: string | null;
  zkProof: ZkProof | null;

  // UI State
  status: 'idle' | 'authenticating' | 'loading' | 'ready' | 'error';
  error: string | null;

  // Actions
  login: () => Promise<void>;
  handleCallback: (jwt: string) => Promise<void>;
  logout: () => void;
}
