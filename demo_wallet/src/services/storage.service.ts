/**
 * Storage Service - handles secure data storage
 */

import type { EphemeralKeyData } from '../types/zklogin.types';

export class StorageService {
  /**
   * Save ephemeral key data to sessionStorage
   *
   * @param data - Ephemeral key data
   */
  static saveEphemeralData(data: EphemeralKeyData): void {
    sessionStorage.setItem('zklogin_ephemeral', JSON.stringify(data));
  }

  /**
   * Load ephemeral key data from sessionStorage
   *
   * @returns Ephemeral key data or null
   */
  static loadEphemeralData(): EphemeralKeyData | null {
    const data = sessionStorage.getItem('zklogin_ephemeral');
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Save JWT to sessionStorage
   *
   * @param jwt - JWT token
   */
  static saveJWT(jwt: string): void {
    sessionStorage.setItem('zklogin_jwt', jwt);
  }

  /**
   * Load JWT from sessionStorage
   *
   * @returns JWT token or null
   */
  static loadJWT(): string | null {
    return sessionStorage.getItem('zklogin_jwt');
  }

  /**
   * Clear all zkLogin data from storage
   */
  static clearAllData(): void {
    sessionStorage.removeItem('zklogin_ephemeral');
    sessionStorage.removeItem('zklogin_jwt');
    sessionStorage.removeItem('zklogin_salt');
    sessionStorage.removeItem('zklogin_proof');
    sessionStorage.removeItem('zklogin-wallet-storage');
    localStorage.removeItem('zklogin-wallet-storage');
  }

  /**
   * Check if user has active session
   *
   * @returns true if session exists
   */
  static hasActiveSession(): boolean {
    return (
      sessionStorage.getItem('zklogin_ephemeral') !== null &&
      sessionStorage.getItem('zklogin_jwt') !== null
    );
  }
}
