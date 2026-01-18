import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as jose from 'jose';
import { verifyJWT } from './jwt.service.js';
import * as oauthProviders from '../config/oauth-providers.js';
import { OAuthProvider } from '../types/index.js';

// Mock the logger to prevent console output during tests
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock jose.createRemoteJWKSet for controlled JWKS responses
const mockJwkSet = vi.fn();
const mockJwtVerify = vi.fn();

vi.mock('jose', async (importOriginal) => {
  const actualJose = await importOriginal<typeof jose>();
  return {
    ...actualJose,
    createRemoteJWKSet: vi.fn(() => mockJwkSet),
    jwtVerify: vi.fn((token, jwks, options) => mockJwtVerify(token, jwks, options)),
  };
});

describe('jwt.service', () => {
  const MOCK_JWT_SECRET = new TextEncoder().encode('some-super-secret-key-that-is-32-bytes');
  const MOCK_GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
  const MOCK_KAKAO_JWKS_URI = 'https://kauth.kakao.com/.well-known/jwks.json';

  const MOCK_GOOGLE_PROVIDER: OAuthProvider = {
    name: 'google',
    jwksUri: MOCK_GOOGLE_JWKS_URI,
    issuers: ['https://accounts.google.com'],
  };

  const MOCK_KAKAO_PROVIDER: OAuthProvider = {
    name: 'kakao',
    jwksUri: MOCK_KAKAO_JWKS_URI,
    issuers: ['https://kauth.kakao.com'],
  };

  const generateMockJwt = async (issuer: string, expiresIn: string | number = '1h', overrides?: Partial<jose.JWTPayload>) => {
    return new jose.SignJWT({
      sub: 'testuser123',
      aud: 'testclientid',
      iat: Math.floor(Date.now() / 1000),
      ...overrides,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(issuer)
      .setExpirationTime(expiresIn)
      .sign(MOCK_JWT_SECRET);
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    // Re-mock getProviderByIssuer for consistent test behavior
    vi.spyOn(oauthProviders, 'getProviderByIssuer').mockImplementation((issuer: string) => {
      if (issuer === MOCK_GOOGLE_PROVIDER.issuers[0]) return MOCK_GOOGLE_PROVIDER;
      if (issuer === MOCK_KAKAO_PROVIDER.issuers[0]) return MOCK_KAKAO_PROVIDER;
      return undefined;
    });

    // Default mock for jwtVerify success
    mockJwtVerify.mockResolvedValue({
      payload: {
        iss: MOCK_GOOGLE_PROVIDER.issuers[0],
        sub: 'testuser123',
        aud: 'testclientid',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      },
    });

    // Mock createRemoteJWKSet to return the mock JwkSet function for simplicity
    // In a real scenario, this would return an actual JWKS resolver, but for unit tests,
    // we directly control jwtVerify's outcome.
    jose.createRemoteJWKSet = vi.fn(() => vi.fn());
  });

  // --- Test Cases ---

  it('should successfully verify a valid JWT', async () => {
    const jwt = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0]);
    const result = await verifyJWT(jwt);

    expect(result.valid).toBe(true);
    expect(result.claims).toBeDefined();
    expect(result.claims?.sub).toBe('testuser123');
    expect(result.claims?.iss).toBe(MOCK_GOOGLE_PROVIDER.issuers[0]);
    expect(oauthProviders.getProviderByIssuer).toHaveBeenCalledWith(MOCK_GOOGLE_PROVIDER.issuers[0]);
    expect(jose.createRemoteJWKSet).toHaveBeenCalledWith(new URL(MOCK_GOOGLE_JWKS_URI));
    expect(mockJwtVerify).toHaveBeenCalledTimes(1);
  });

  it('should return valid: false for an expired JWT', async () => {
    mockJwtVerify.mockRejectedValueOnce(new jose.errors.JWTExpired('JWT expired'));
    const jwt = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0], '0s'); // Expired JWT
    const result = await verifyJWT(jwt);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('jwt_expired');
  });

  it('should return valid: false for an invalid signature', async () => {
    mockJwtVerify.mockRejectedValueOnce(new jose.errors.JWSSignatureVerificationFailed());
    const jwt = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0]);
    const result = await verifyJWT(jwt);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });

  it('should return valid: false for an unknown issuer', async () => {
    const jwt = await generateMockJwt('https://unknown.issuer.com');
    const result = await verifyJWT(jwt);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('unknown_provider: https://unknown.issuer.com');
    expect(oauthProviders.getProviderByIssuer).toHaveBeenCalledWith('https://unknown.issuer.com');
    expect(jose.createRemoteJWKSet).not.toHaveBeenCalled(); // Should not try to fetch JWKS for unknown issuer
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });

  it('should return valid: false if JWT is missing issuer claim', async () => {
    const jwt = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0], '1h', { iss: undefined }); // Force missing issuer
    const unverified = jose.decodeJwt(jwt); // Mock unverified decode for test
    vi.spyOn(jose, 'decodeJwt').mockReturnValueOnce({ ...unverified, iss: undefined });

    const result = await verifyJWT(jwt);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_jwt: missing issuer claim');
  });

  it('should return valid: false if JWT is missing subject claim', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        iss: MOCK_GOOGLE_PROVIDER.issuers[0],
        aud: 'testclientid',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      },
    });
    const jwt = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0]);
    const result = await verifyJWT(jwt);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_jwt: missing subject claim');
  });

  it('should return valid: false if JWT is missing audience claim', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        iss: MOCK_GOOGLE_PROVIDER.issuers[0],
        sub: 'testuser123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      },
    });
    const jwt = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0]);
    const result = await verifyJWT(jwt);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_jwt: missing audience claim');
  });

  it('should use cached JWKS for subsequent calls within TTL', async () => {
    const jwt1 = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0]);
    await verifyJWT(jwt1); // First call fetches and caches

    const jwt2 = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0]);
    await verifyJWT(jwt2); // Second call should use cache

    expect(jose.createRemoteJWKSet).toHaveBeenCalledTimes(1); // JWKS fetched only once
    expect(mockJwtVerify).toHaveBeenCalledTimes(2);
  });

  it('should refetch JWKS when cached entry expires', async () => {
    vi.useFakeTimers();
    const jwt = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0]);

    await verifyJWT(jwt); // Fetches and caches
    expect(jose.createRemoteJWKSet).toHaveBeenCalledTimes(1);

    // Advance time beyond TTL (1 hour + 1ms)
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);

    await verifyJWT(jwt); // Should refetch
    expect(jose.createRemoteJWKSet).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('should successfully verify JWTs from Kakao provider', async () => {
    vi.spyOn(oauthProviders, 'getProviderByIssuer').mockReturnValueOnce(MOCK_KAKAO_PROVIDER);
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        iss: MOCK_KAKAO_PROVIDER.issuers[0],
        sub: 'kakao_user_id',
        aud: 'kakao_client_id',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      },
    });

    const jwt = await generateMockJwt(MOCK_KAKAO_PROVIDER.issuers[0]);
    const result = await verifyJWT(jwt);

    expect(result.valid).toBe(true);
    expect(result.claims?.iss).toBe(MOCK_KAKAO_PROVIDER.issuers[0]);
    expect(jose.createRemoteJWKSet).toHaveBeenCalledWith(new URL(MOCK_KAKAO_JWKS_URI));
  });

  it('should trigger background refresh before expiration', async () => {
    vi.useFakeTimers();
    const jwt = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0]);

    await verifyJWT(jwt); // Initial fetch and cache
    expect(jose.createRemoteJWKSet).toHaveBeenCalledTimes(1);

    // Advance time to just before refresh point (TTL - REFRESH_BEFORE_EXPIRATION_MS)
    vi.advanceTimersByTime( (60 * 60 * 1000) - (5 * 60 * 1000) - 1 );
    expect(jose.createRemoteJWKSet).toHaveBeenCalledTimes(1); // No refresh yet

    vi.advanceTimersByTime(1); // Advance by 1ms to trigger refresh
    // Expect background refresh to be called shortly after, so createRemoteJWKSet should be called again.
    // The actual call might be slightly delayed, so we check if it's called at least once more.
    expect(jose.createRemoteJWKSet).toHaveBeenCalledTimes(2); // Background refresh should have happened

    vi.useRealTimers();
  });

  it('should handle errors during background refresh gracefully', async () => {
    vi.useFakeTimers();
    const jwt = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0]);

    await verifyJWT(jwt); // Initial fetch and cache
    expect(jose.createRemoteJWKSet).toHaveBeenCalledTimes(1);

    // Mock jose.createRemoteJWKSet to throw an error for the next call (background refresh)
    jose.createRemoteJWKSet.mockImplementationOnce(() => {
      throw new Error('Network error during background refresh');
    });

    // Advance time to trigger refresh
    vi.advanceTimersByTime((60 * 60 * 1000) - (5 * 60 * 1000));

    expect(jose.createRemoteJWKSet).toHaveBeenCalledTimes(2); // Background refresh attempted
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to refresh JWKS'),
      expect.any(Object)
    );

    // Verify subsequent call still uses the old cached JWKS (it wasn't replaced)
    await verifyJWT(jwt);
    expect(jose.createRemoteJWKSet).toHaveBeenCalledTimes(2); // No new fetch as error occurred and old cache used

    vi.useRealTimers();
  });

  it('should return valid: false for invalid JWKS URI (TypeError)', async () => {
    vi.spyOn(oauthProviders, 'getProviderByIssuer').mockReturnValueOnce({
      ...MOCK_GOOGLE_PROVIDER,
      jwksUri: 'invalid-url', // Malformed URL
    });
    const jwt = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0]);

    const result = await verifyJWT(jwt);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_jwks_uri: malformed URL');
  });

  it('should return valid: false for generic verification failures', async () => {
    mockJwtVerify.mockRejectedValueOnce(new Error('Some unexpected error'));
    const jwt = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0]);

    const result = await verifyJWT(jwt);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('verification_failed: Some unexpected error');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('JWT verification failed with unexpected error'),
      expect.any(Object)
    );
  });
});
