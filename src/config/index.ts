import { loadOAuthProviders } from "./oauth-providers.js";
import { loadSaltProviderConfig } from "./salt-providers.js";

export interface Config {
  port: number;
  logLevel: string;
  corsOrigins: string;
  rateLimitMax: number;
  saltProvider: ReturnType<typeof loadSaltProviderConfig>;
  oauthProviders: ReturnType<typeof loadOAuthProviders>;
}

function loadConfig(): Config {
  return {
    port: parseInt(process.env["PORT"] ?? "3000", 10),
    logLevel: process.env["LOG_LEVEL"] ?? "info",
    corsOrigins: process.env["CORS_ORIGINS"] ?? "*",
    rateLimitMax: parseInt(process.env["RATE_LIMIT_MAX"] ?? "100", 10),
    saltProvider: loadSaltProviderConfig(),
    oauthProviders: loadOAuthProviders(),
  };
}

export const config = loadConfig();
