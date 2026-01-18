import type { OAuthProvider } from "../types/index.js";

const DEFAULT_PROVIDERS: OAuthProvider[] = [
  {
    name: "google",
    jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
    issuers: ["https://accounts.google.com"],
  },
  {
    name: "facebook",
    jwksUri: "https://www.facebook.com/.well-known/oauth/openid/jwks/",
    issuers: ["https://www.facebook.com"],
  },
  {
    name: "apple",
    jwksUri: "https://appleid.apple.com/auth/keys",
    issuers: ["https://appleid.apple.com"],
  },
  {
    name: "twitch",
    jwksUri: "https://id.twitch.tv/oauth2/keys",
    issuers: ["https://id.twitch.tv/oauth2"],
  },
  {
    name: "kakao",
    jwksUri: "https://kauth.kakao.com/.well-known/jwks.json",
    issuers: ["https://kauth.kakao.com"],
  },
  {
    name: "slack",
    jwksUri: "https://slack.com/oauth/v2/keys",
    issuers: ["https://slack.com"],
  },
];

export function loadOAuthProviders(): OAuthProvider[] {
  // TODO: Support custom provider configuration via environment variables
  return DEFAULT_PROVIDERS;
}

export function getProviderByIssuer(issuer: string): OAuthProvider | undefined {
  return DEFAULT_PROVIDERS.find((p) => p.issuers.includes(issuer));
}

