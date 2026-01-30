/**
 * Wallet Service - handles Sui network interactions and zkLogin address computation
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { computeAddress } from '../utils/zklogin.utils';

export class WalletService {
  private client: SuiClient;

  constructor() {
    const rpcUrl = import.meta.env.VITE_SUI_RPC_URL;

    if (!rpcUrl) {
      throw new Error('VITE_SUI_RPC_URL is not defined in environment variables');
    }

    this.client = new SuiClient({ url: rpcUrl });
  }

  /**
   * Compute zkLogin address from JWT and salt
   *
   * @param jwt - OAuth JWT token
   * @param salt - User salt
   * @returns Sui address
   */
  async computeZkLoginAddress(jwt: string, salt: string): Promise<string> {
    return computeAddress(jwt, salt);
  }

  /**
   * Get SUI balance for an address
   *
   * @param address - Sui address
   * @returns Balance in SUI (not MIST)
   */
  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.client.getBalance({ owner: address });
      // Convert from MIST to SUI (1 SUI = 10^9 MIST)
      return (BigInt(balance.totalBalance) / 1_000_000_000n).toString();
    } catch (error) {
      console.error('Failed to get balance:', error);
      return '0';
    }
  }

  /**
   * Get transaction history for an address
   *
   * @param address - Sui address
   * @param limit - Number of transactions to fetch
   * @returns Transaction history
   */
  async getTransactionHistory(address: string, limit = 10) {
    try {
      return this.client.queryTransactionBlocks({
        filter: { FromAddress: address },
        limit,
        order: 'descending'
      });
    } catch (error) {
      console.error('Failed to get transaction history:', error);
      return { data: [], hasNextPage: false };
    }
  }

  /**
   * Get current epoch
   *
   * @returns Current epoch number
   */
  async getCurrentEpoch(): Promise<number> {
    try {
      const epoch = await this.client.getLatestSuiSystemState();
      return Number(epoch.epoch);
    } catch (error) {
      console.error('Failed to get current epoch:', error);
      return 0;
    }
  }
}
