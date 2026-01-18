import * as jose from "jose";
import type { OAuthProviderConfig } from "../config/oauth-providers.js";
import { getProviderByIssuer } from "../config/oauth-providers.js";
import { logger } from "../utils/logger.js";

// JWKS Cache TTL (1 hour)
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;
// Refresh JWKS 5 minutes before its TTL expires
const REFRESH_BEFORE_EXPIRATION_MS = 5 * 60 * 1000;

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

interface JwksCacheEntry {
  jwks: jose.JWTVerifyGetKey;
  expiresAt: number;
}

const jwksCache = new Map<string, JwksCacheEntry>();
const scheduledRefreshes = new Map<string, NodeJS.Timeout>();

function scheduleJwksRefresh(
  provider: OAuthProviderConfig,
  jwksUri: string,
  refreshAfterMs: number
) {
  // Clear any existing scheduled refresh for this JWKS URI
  const existing = scheduledRefreshes.get(jwksUri);
  if (existing) {
    clearTimeout(existing);
    scheduledRefreshes.delete(jwksUri);
  }

  const timeoutId = setTimeout(async () => {
    logger.info(`Attempting to refresh JWKS for ${provider.name} from ${jwksUri}`);
    try {
      const newJwks = jose.createRemoteJWKSet(new URL(jwksUri));
      jwksCache.set(jwksUri, { jwks: newJwks, expiresAt: Date.now() + JWKS_CACHE_TTL_MS });
      logger.info(`Successfully refreshed JWKS for ${provider.name}`);
      // Reschedule for next refresh
      scheduleJwksRefresh(provider, jwksUri, JWKS_CACHE_TTL_MS - REFRESH_BEFORE_EXPIRATION_MS);
    } catch (refreshError) {
      logger.error(`Failed to refresh JWKS for ${provider.name} from ${jwksUri}`, {
        error: refreshError,
      });
    } finally {
      scheduledRefreshes.delete(jwksUri);
    }
  }, refreshAfterMs);

  scheduledRefreshes.set(jwksUri, timeoutId);
}

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

  // Get or create JWKS client with TTL caching
  let jwksEntry = jwksCache.get(provider.jwksUri);

  if (!jwksEntry || jwksEntry.expiresAt < Date.now()) {
    logger.debug(`Fetching new JWKS for ${provider.name} from ${provider.jwksUri}`);
    const jwks = jose.createRemoteJWKSet(new URL(provider.jwksUri));
    jwksEntry = { jwks, expiresAt: Date.now() + JWKS_CACHE_TTL_MS };
    jwksCache.set(provider.jwksUri, jwksEntry);
    // Schedule background refresh
    scheduleJwksRefresh(
      provider,
      provider.jwksUri,
      JWKS_CACHE_TTL_MS - REFRESH_BEFORE_EXPIRATION_MS
    );
  } else {
    logger.debug(`Using cached JWKS for ${provider.name}`);
  }

  try {
    const { payload } = await jose.jwtVerify(token, jwksEntry.jwks, {
      issuer: provider.issuers,
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
