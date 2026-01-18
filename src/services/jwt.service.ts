import * as jose from "jose";
import type { OAuthProviderConfig } from "../config/oauth-providers.js";
import { getProviderByIssuer } from "../config/oauth-providers.js";
import { logger } from "../utils/logger.js";

export interface JWTPayload {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
}

export interface VerifiedJWT {
  payload: JWTPayload;
  provider: OAuthProviderConfig;
}

const jwksCache = new Map<string, jose.JWTVerifyGetKey>();

export async function verifyJWT(token: string): Promise<VerifiedJWT> {
  // Decode without verification to get issuer
  const unverified = jose.decodeJwt(token);

  if (!unverified.iss) {
    throw new JWTError("invalid_jwt", "JWT missing issuer claim");
  }

  const provider = getProviderByIssuer(unverified.iss);
  if (!provider) {
    throw new JWTError("unknown_provider", `Unknown OAuth provider: ${unverified.iss}`);
  }

  // Get or create JWKS client
  let jwks = jwksCache.get(provider.jwksUrl);
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(new URL(provider.jwksUrl));
    jwksCache.set(provider.jwksUrl, jwks);
  }

  try {
    const { payload } = await jose.jwtVerify(token, jwks, {
      issuer: unverified.iss,
    });

    logger.debug("JWT verified successfully", {
      provider: provider.name,
      sub: maskString(payload.sub ?? ""),
    });

    return {
      payload: payload as JWTPayload,
      provider,
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new JWTError("jwt_expired", "JWT has expired");
    }
    if (error instanceof jose.errors.JWTClaimValidationFailed) {
      throw new JWTError("invalid_claims", "JWT claim validation failed");
    }
    if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
      throw new JWTError("invalid_signature", "JWT signature verification failed");
    }

    throw new JWTError("verification_failed", "JWT verification failed");
  }
}

export class JWTError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "JWTError";
  }
}

function maskString(str: string): string {
  if (str.length <= 4) {
    return "****";
  }
  return `${str.slice(0, 2)}...${str.slice(-2)}`;
}
