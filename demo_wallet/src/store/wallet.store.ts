/**
 * Wallet Store - Zustand store for wallet state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WalletState } from '../types/wallet.types';
import { AuthService } from '../services/auth.service';
import { SaltService } from '../services/salt.service';
import { ProverService } from '../services/prover.service';
import { WalletService } from '../services/wallet.service';
import { StorageService } from '../services/storage.service';

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      jwt: null,
      salt: null,
      zkAddress: null,
      zkProof: null,
      status: 'idle',
      error: null,

      // Actions

      /**
       * Initiate Google OAuth login
       */
      login: async () => {
        try {
          set({ status: 'authenticating', error: null });
          const authService = new AuthService();
          await authService.initiateOAuthFlow();
          // Note: This will redirect, so code after this won't execute
        } catch (error) {
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Login failed'
          });
        }
      },

      /**
       * Handle OAuth callback
       * - Fetches salt from Salt Server
       * - Computes zkLogin address
       * - Generates ZK proof
       */
      handleCallback: async (jwt: string) => {
        set({ status: 'loading', jwt, error: null });

        try {
          // 1. Validate JWT
          const authService = new AuthService();
          if (!authService.validateJWT(jwt)) {
            throw new Error('Invalid JWT format');
          }

          // 2. Fetch salt from Salt Server
          const saltService = new SaltService();
          const salt = await saltService.fetchSalt(jwt);

          // 3. Compute zkLogin address
          const walletService = new WalletService();
          const zkAddress = await walletService.computeZkLoginAddress(jwt, salt);

          // 4. Load ephemeral data
          const ephemeralData = StorageService.loadEphemeralData();
          if (!ephemeralData) {
            throw new Error('Ephemeral key data not found. Please login again.');
          }

          // 5. Generate ZK proof
          const proverService = new ProverService();
          const zkProof = await proverService.generateZkProof({
            jwt,
            salt,
            ephemeralPublicKey: ephemeralData.privateKey, // TODO: Convert to public key properly
            maxEpoch: ephemeralData.maxEpoch,
            randomness: ephemeralData.randomness
          });

          // 6. Cache proof
          proverService.cacheProof(zkProof);

          // 7. Update state
          set({
            salt,
            zkAddress,
            zkProof,
            isAuthenticated: true,
            status: 'ready',
            error: null
          });

        } catch (error) {
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to process callback'
          });
        }
      },

      /**
       * Logout
       * - Clears all stored data
       * - Resets state
       */
      logout: () => {
        StorageService.clearAllData();
        set({
          isAuthenticated: false,
          jwt: null,
          salt: null,
          zkAddress: null,
          zkProof: null,
          status: 'idle',
          error: null
        });
      }
    }),
    {
      name: 'zklogin-wallet-storage',
      partialize: (state) => ({
        // Only persist non-sensitive data
        isAuthenticated: state.isAuthenticated,
        zkAddress: state.zkAddress
      })
    }
  )
);
