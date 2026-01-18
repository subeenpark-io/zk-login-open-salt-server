import * as jose from "jose";
import type { OAuthProvider, JWTClaims, VerifyResult } from "../types/index.js";
import { getProviderByIssuer } from "../config/oauth-providers.js";
import { logger } from "../utils/logger.js";

// JWKS Cache TTL (1 hour)
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;
// Refresh JWKS 5 minutes before its TTL expires
const REFRESH_BEFORE_EXPIRATION_MS = 5 * 60 * 1000;

interface JwksCacheEntry {
  jwks: jose.JWTVerifyGetKey;
  expiresAt: number;
}

const jwksCache = new Map<string, JwksCacheEntry>();
const scheduledRefreshes = new Map<string, NodeJS.Timeout>();

function scheduleJwksRefresh(provider: OAuthProvider, jwksUri: string, refreshAfterMs: number) {
  // Clear any existing scheduled refresh for this JWKS URI
  if (scheduledRefreshes.has(jwksUri)) {
    clearTimeout(scheduledRefreshes.get(jwksUri)!);
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
      logger.error(`Failed to refresh JWKS for ${provider.name} from ${jwksUri}: ${refreshError}`);
      // On failure, retry sooner or rely on on-demand fetching
      // For simplicity, for now, we'll just log and let on-demand fetching handle it if background fails
    } finally {
      scheduledRefreshes.delete(jwksUri);
    }
  }, refreshAfterMs);

  scheduledRefreshes.set(jwksUri, timeoutId);
}

export async function verifyJWT(token: string): Promise<VerifyResult> {
  let claims: JWTClaims;

  try {
    // Decode without verification to get issuer
    const unverified = jose.decodeJwt(token);

    if (!unverified.iss) {
      return { valid: false, error: "invalid_jwt: missing issuer claim" };
    }

    const provider = getProviderByIssuer(unverified.iss);
    if (!provider) {
      return { valid: false, error: `unknown_provider: ${unverified.iss}` };
    }

    // Get or create JWKS client with TTL caching
    let jwksEntry = jwksCache.get(provider.jwksUri);

    if (!jwksEntry || jwksEntry.expiresAt < Date.now()) {
      logger.debug(`Fetching new JWKS for ${provider.name} from ${provider.jwksUri}`);
      const jwks = jose.createRemoteJWKSet(new URL(provider.jwksUri));
      jwksEntry = { jwks, expiresAt: Date.now() + JWKS_CACHE_TTL_MS };
      jwksCache.set(provider.jwksUri, jwksEntry);
      // Schedule background refresh
      scheduleJwksRefresh(provider, provider.jwksUri, JWKS_CACHE_TTL_MS - REFRESH_BEFORE_EXPIRATION_MS);
    } else {
      logger.debug(`Using cached JWKS for ${provider.name}`);
    }

    const { payload } = await jose.jwtVerify(token, jwksEntry.jwks, {
      issuer: provider.issuers, // Validate against all known issuers for the provider
    });

    if (!payload.sub) {
      return { valid: false, error: "invalid_jwt: missing subject claim" };
    }
    if (!payload.aud) {
      return { valid: false, error: "invalid_jwt: missing audience claim" };
    }

    claims = payload as JWTClaims;

    logger.info("JWT verified successfully", {
      provider: provider.name,
      sub: maskString(claims.sub),
    });

    return { valid: true, claims };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      return { valid: false, error: "jwt_expired" };
    }
    if (error instanceof jose.errors.JWTClaimValidationFailed) {
      return { valid: false, error: `invalid_claims: ${error.message}` };
    }
    if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
      return { valid: false, error: "invalid_signature" };
    }
    if (error instanceof TypeError && error.message.includes("Invalid URL")) {
      return { valid: false, error: "invalid_jwks_uri: malformed URL" };
    }
    if (error instanceof Error) {
      logger.error("JWT verification failed with unexpected error", { error: error.message });
      return { valid: false, error: `verification_failed: ${error.message}` };
    }
    return { valid: false, error: "verification_failed: unknown error" };
  }
}

function maskString(str: string): string {
  if (str.length <= 4) {
    return "****";
  }
  return `${str.slice(0, 2)}...${str.slice(-2)}`;
}
