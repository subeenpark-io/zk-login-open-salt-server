import { describe, it, expect, beforeEach, vi } from "vitest";
import * as jose from "jose";
import { verifyJWT, JWTError } from "./jwt.service.js";
import * as oauthProviders from "../config/oauth-providers.js";
import type { OAuthProviderConfig } from "../types/index.js";

// Mock the logger to prevent console output during tests
vi.mock("../utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock jose.createRemoteJWKSet for controlled JWKS responses
const mockJwkSet = vi.fn();
const mockJwtVerify = vi.fn();

vi.mock("jose", async (importOriginal) => {
  const actualJose = await importOriginal<typeof jose>();
  return {
    ...actualJose,
    createRemoteJWKSet: vi.fn(() => mockJwkSet),
    jwtVerify: vi.fn((token, jwks, options) => mockJwtVerify(token, jwks, options)),
  };
});

describe("jwt.service", () => {
  const MOCK_JWT_SECRET = new TextEncoder().encode("some-super-secret-key-that-is-32-bytes");
  const MOCK_GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
  const MOCK_KAKAO_JWKS_URI = "https://kauth.kakao.com/.well-known/jwks.json";

  const MOCK_GOOGLE_PROVIDER: OAuthProviderConfig = {
    name: "google",
    jwksUri: MOCK_GOOGLE_JWKS_URI,
    issuers: ["https://accounts.google.com"],
  };

  const MOCK_KAKAO_PROVIDER: OAuthProviderConfig = {
    name: "kakao",
    jwksUri: MOCK_KAKAO_JWKS_URI,
    issuers: ["https://kauth.kakao.com"],
  };

  const generateMockJwt = async (
    issuer: string,
    expiresIn: string | number = "1h",
    overrides?: Partial<jose.JWTPayload>
  ) => {
    return new jose.SignJWT({
      sub: "testuser123",
      aud: "testclientid",
      iat: Math.floor(Date.now() / 1000),
      ...overrides,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setExpirationTime(expiresIn)
      .sign(MOCK_JWT_SECRET);
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    // Re-mock getProviderByIssuer for consistent test behavior
    vi.spyOn(oauthProviders, "getProviderByIssuer").mockImplementation((issuer: string) => {
      if (issuer === MOCK_GOOGLE_PROVIDER.issuers[0]) return MOCK_GOOGLE_PROVIDER;
      if (issuer === MOCK_KAKAO_PROVIDER.issuers[0]) return MOCK_KAKAO_PROVIDER;
      return undefined;
    });

    // Default mock for jwtVerify success
    mockJwtVerify.mockResolvedValue({
      payload: {
        iss: MOCK_GOOGLE_PROVIDER.issuers[0],
        sub: "testuser123",
        aud: "testclientid",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      },
    });

    // Mock createRemoteJWKSet to return the mock JwkSet function
    (jose.createRemoteJWKSet as ReturnType<typeof vi.fn>).mockReturnValue(vi.fn());
  });

  // --- Test Cases ---

  it("should successfully verify a valid JWT", async () => {
    const jwt = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0] ?? "");
    const result = await verifyJWT(jwt);

    expect(result.payload).toBeDefined();
    expect(result.payload.sub).toBe("testuser123");
    expect(result.payload.iss).toBe(MOCK_GOOGLE_PROVIDER.issuers[0]);
    expect(result.provider.name).toBe("google");
    expect(oauthProviders.getProviderByIssuer).toHaveBeenCalledWith(
      MOCK_GOOGLE_PROVIDER.issuers[0]
    );
    expect(jose.createRemoteJWKSet).toHaveBeenCalledWith(new URL(MOCK_GOOGLE_JWKS_URI));
    expect(mockJwtVerify).toHaveBeenCalledTimes(1);
  });

  it("should throw JWTError for an expired JWT", async () => {
    const payload = {
      iss: MOCK_GOOGLE_PROVIDER.issuers[0] as string,
      sub: "testuser123",
      aud: "testclientid",
      exp: Math.floor(Date.now() / 1000) - 100,
      iat: Math.floor(Date.now() / 1000) - 200,
    };
    mockJwtVerify.mockRejectedValue(
      new jose.errors.JWTExpired("JWT expired", payload as jose.JWTPayload, "exp")
    );
    const jwt = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0] ?? "", "0s");

    await expect(verifyJWT(jwt)).rejects.toThrow(JWTError);
  });

  it("should throw JWTError for an invalid signature", async () => {
    mockJwtVerify.mockRejectedValue(new jose.errors.JWSSignatureVerificationFailed());
    const jwt = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0] ?? "");

    await expect(verifyJWT(jwt)).rejects.toThrow(JWTError);
  });

  it("should throw JWTError for an unknown issuer", async () => {
    const jwt = await generateMockJwt("https://unknown.issuer.com");

    await expect(verifyJWT(jwt)).rejects.toThrow(JWTError);
    await expect(verifyJWT(jwt)).rejects.toMatchObject({ code: "unknown_provider" });
    expect(oauthProviders.getProviderByIssuer).toHaveBeenCalledWith("https://unknown.issuer.com");
    expect(jose.createRemoteJWKSet).not.toHaveBeenCalled();
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });

  it("should throw JWTError if JWT is missing issuer claim", async () => {
    const jwt = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0] ?? "", "1h");
    vi.spyOn(jose, "decodeJwt").mockReturnValueOnce({
      sub: "testuser123",
      aud: "testclientid",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      // iss is intentionally missing
    });

    await expect(verifyJWT(jwt)).rejects.toThrow(JWTError);
  });

  it("should call jwtVerify for each request", async () => {
    const jwt1 = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0] ?? "");
    await verifyJWT(jwt1);

    const jwt2 = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0] ?? "");
    await verifyJWT(jwt2);

    expect(mockJwtVerify).toHaveBeenCalledTimes(2);
  });

  it("should successfully verify JWTs from Kakao provider", async () => {
    vi.spyOn(oauthProviders, "getProviderByIssuer").mockReturnValueOnce(MOCK_KAKAO_PROVIDER);
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        iss: MOCK_KAKAO_PROVIDER.issuers[0],
        sub: "kakao_user_id",
        aud: "kakao_client_id",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      },
    });

    const jwt = await generateMockJwt(MOCK_KAKAO_PROVIDER.issuers[0] ?? "");
    const result = await verifyJWT(jwt);

    expect(result.payload.iss).toBe(MOCK_KAKAO_PROVIDER.issuers[0]);
    expect(result.provider.name).toBe("kakao");
    expect(jose.createRemoteJWKSet).toHaveBeenCalledWith(new URL(MOCK_KAKAO_JWKS_URI));
  });

  it("should throw JWTError for generic verification failures", async () => {
    mockJwtVerify.mockRejectedValue(new Error("Some unexpected error"));
    const jwt = await generateMockJwt(MOCK_GOOGLE_PROVIDER.issuers[0] ?? "");

    await expect(verifyJWT(jwt)).rejects.toThrow(JWTError);
  });
});
