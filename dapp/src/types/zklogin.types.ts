/**
 * zkLogin related type definitions
 */

export interface ZkProofParams {
  jwt: string;
  salt: string;
  ephemeralPublicKey: string;
  maxEpoch: number;
  randomness: string;
}

export interface ZkProof {
  // ZK proof structure from Mysten Prover
  [key: string]: any;
}

export interface EphemeralKeyData {
  privateKey: string;
  maxEpoch: number;
  randomness: string;
}
