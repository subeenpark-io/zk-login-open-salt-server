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
  proofPoints: {
    a: string[];
    b: string[][];
    c: string[];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
}

export interface EphemeralKeyData {
  privateKey: string;
  extendedEphemeralPublicKey: string;
  maxEpoch: number;
  randomness: string;
}
