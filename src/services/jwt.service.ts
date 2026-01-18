import * as jose from "jose";
import type { OAuthProviderConfig } from "../config/oauth-providers.js";
import { getProviderByIssuer } from "../config/oauth-providers.js";
import { logger } from "../utils/logger.js";
import type { VerifyResult, JWTClaims } from "../types/index.js";

const jwksCache = new Map<string, jose.JWTVerifyGetKey>();

export interface VerifiedJWT {
  result: VerifyResult;
  provider?: OAuthProviderConfig | undefined;
}

export async function verifyJWT(token: string): Promise<VerifiedJWT> {
  let claims: JWTClaims;

  const unverified = jose.decodeJwt(token);

  if (!unverified.iss) {
    return {
      result: { valid: false, error: "JWT missing issuer claim" },
    };
  }

  const provider = getProviderByIssuer(unverified.iss);
  if (!provider) {
    return {
      result: { valid: false, error: `Unknown OAuth provider: ${unverified.iss}` },
    };
  }

  let jwks = jwksCache.get(provider.jwksUri);
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(new URL(provider.jwksUri));
    jwksCache.set(provider.jwksUri, jwks);
  }

  try {
    const { payload } = await jose.jwtVerify(token, jwks, {
      issuer: unverified.iss,
    });

    claims = {
      sub: payload.sub ?? "",
      aud: payload.aud ?? "",
      iss: payload.iss ?? "",
      exp: payload.exp ?? 0,
      iat: payload.iat ?? 0,
      nonce: payload["nonce"] as string | undefined,
    };

    logger.debug("JWT verified successfully", {
      provider: provider.name,
      sub: maskString(claims.sub),
    });

    return {
      result: { valid: true, claims },
      provider,
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      return {
        result: { valid: false, error: "JWT has expired" },
        provider,
      };
    }
    if (error instanceof jose.errors.JWTClaimValidationFailed) {
      return {
        result: { valid: false, error: "JWT claim validation failed" },
        provider,
      };
    }
    if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
      return {
        result: { valid: false, error: "JWT signature verification failed" },
        provider,
      };
    }

    return {
      result: { valid: false, error: "JWT verification failed" },
      provider,
    };
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
