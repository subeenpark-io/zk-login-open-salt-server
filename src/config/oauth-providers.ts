import type { OAuthProviderConfig } from "../types/index.js";

const DEFAULT_PROVIDERS: OAuthProviderConfig[] = [
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
    jwksUri: "https://slack.com/openid/connect/keys",
    issuers: ["https://slack.com"],
  },
  {
    name: "microsoft",
    jwksUri: "https://login.microsoftonline.com/common/discovery/v2.0/keys",
    issuers: ["https://login.microsoftonline.com"],
  },
];

export function loadOAuthProviders(): OAuthProviderConfig[] {
  return DEFAULT_PROVIDERS;
}

export function getProviderByIssuer(issuer: string): OAuthProviderConfig | undefined {
  return DEFAULT_PROVIDERS.find((p) => p.issuers.some((i) => issuer.startsWith(i)));
}

export type { OAuthProviderConfig } from "../types/index.js";
