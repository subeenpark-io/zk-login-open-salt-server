/**
 * Wallet Service - handles Sui network interactions and zkLogin address computation
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getZkLoginSignature, genAddressSeed } from '@mysten/sui/zklogin';
import { computeAddress } from '../utils/zklogin.utils';
import type { ZkProof } from '../types/zklogin.types';

export class WalletService {
  private client: SuiClient;
  private sponsorAddress: string | null = null;

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
   * @returns Transaction history with details
   */
  async getTransactionHistory(address: string, limit = 10) {
    try {
      // Query both sent and received transactions
      const [fromResult, toResult] = await Promise.all([
        this.client.queryTransactionBlocks({
          filter: { FromAddress: address },
          limit,
          order: 'descending',
          options: {
            showInput: true,
            showEffects: true,
            showBalanceChanges: true,
          }
        }),
        this.client.queryTransactionBlocks({
          filter: { ToAddress: address },
          limit,
          order: 'descending',
          options: {
            showInput: true,
            showEffects: true,
            showBalanceChanges: true,
          }
        })
      ]);

      // Merge and deduplicate by digest
      const allTxs = [...fromResult.data, ...toResult.data];
      const uniqueTxs = allTxs.reduce((acc, tx) => {
        if (!acc.find(t => t.digest === tx.digest)) {
          acc.push(tx);
        }
        return acc;
      }, [] as typeof allTxs);

      // Sort by timestamp descending
      uniqueTxs.sort((a, b) => {
        const timeA = a.timestampMs ? parseInt(a.timestampMs) : 0;
        const timeB = b.timestampMs ? parseInt(b.timestampMs) : 0;
        return timeB - timeA;
      });

      return { data: uniqueTxs.slice(0, limit), hasNextPage: false };
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

  /**
   * Send SUI to another address using zkLogin
   *
   * @param params - Send parameters
   * @returns Transaction digest
   */
  async sendSui(params: {
    fromAddress: string;
    toAddress: string;
    amount: string; // in SUI (not MIST)
    privateKey: string;
    zkProof: ZkProof;
    maxEpoch: number;
    userSalt: string;
    jwt: string;
  }): Promise<string> {
    const { fromAddress, toAddress, amount, privateKey, zkProof, maxEpoch, userSalt, jwt } = params;

    // Convert SUI to MIST
    const amountInMist = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000));

    // Restore keypair from private key
    const keypair = Ed25519Keypair.fromSecretKey(privateKey);

    // Build transaction
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [amountInMist]);
    tx.transferObjects([coin], toAddress);
    tx.setSender(fromAddress);
    tx.setGasOwner(await this.getSponsorAddress());

    // Get transaction bytes
    const { bytes, signature: userSignature } = await tx.sign({
      client: this.client,
      signer: keypair,
    });

    // Parse JWT to get iss claim
    const jwtParts = jwt.split('.');
    const jwtPayload = JSON.parse(atob(jwtParts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Create zkLogin signature
    const addressSeed = this.computeAddressSeed(userSalt, jwtPayload.sub, jwtPayload.aud);
    const zkLoginSignature = getZkLoginSignature({
      inputs: {
        proofPoints: zkProof.proofPoints,
        issBase64Details: zkProof.issBase64Details,
        headerBase64: zkProof.headerBase64,
        addressSeed,
      },
      maxEpoch,
      userSignature,
    });

    return this.executeSponsoredTransaction(bytes, zkLoginSignature);
  }

  /**
   * Compute address seed for zkLogin signature
   */
  private computeAddressSeed(salt: string, sub: string, aud: string): string {
    return genAddressSeed(BigInt(salt), 'sub', sub, aud).toString();
  }

  /**
   * Load sponsor address from server (cached in memory)
   */
  private async getSponsorAddress(): Promise<string> {
    if (this.sponsorAddress) {
      return this.sponsorAddress;
    }

    const response = await fetch('/api/sponsor/info');
    const data = await response.json().catch(() => ({}));

    if (!response.ok || typeof data.sponsorAddress !== 'string') {
      throw new Error(
        data.error || 'Sponsored transactions are not available. Please contact the operator.'
      );
    }

    this.sponsorAddress = data.sponsorAddress;
    return data.sponsorAddress;
  }

  /**
   * Execute transaction via sponsor server endpoint
   */
  private async executeSponsoredTransaction(
    transactionBlock: string,
    userSignature: string
  ): Promise<string> {
    const response = await fetch('/api/sponsor/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionBlock,
        userSignature,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Sponsored execution failed');
    }

    if (typeof data.digest !== 'string') {
      throw new Error('Sponsored execution response is missing digest');
    }

    return data.digest;
  }

  /**
   * Get SUI client instance
   */
  getClient(): SuiClient {
    return this.client;
  }
}
