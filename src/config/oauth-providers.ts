export interface OAuthProviderConfig {
  name: string;
  jwksUrl: string;
}

const DEFAULT_PROVIDERS: OAuthProviderConfig[] = [
  {
    name: "google",
    jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
  },
  {
    name: "facebook",
    jwksUrl: "https://www.facebook.com/.well-known/oauth/openid/jwks/",
  },
  {
    name: "apple",
    jwksUrl: "https://appleid.apple.com/auth/keys",
  },
  {
    name: "twitch",
    jwksUrl: "https://id.twitch.tv/oauth2/keys",
  },
];

export function loadOAuthProviders(): OAuthProviderConfig[] {
  // TODO: Support custom provider configuration via environment variables
  return DEFAULT_PROVIDERS;
}

export function getProviderByIssuer(issuer: string): OAuthProviderConfig | undefined {
  const issuerToProvider: Record<string, string> = {
    "https://accounts.google.com": "google",
    "https://www.facebook.com": "facebook",
    "https://appleid.apple.com": "apple",
    "https://id.twitch.tv/oauth2": "twitch",
  };

  const providerName = issuerToProvider[issuer];
  if (!providerName) {
    return undefined;
  }

  return DEFAULT_PROVIDERS.find((p) => p.name === providerName);
}
