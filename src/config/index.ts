import type { AppConfig, ProviderConfig } from "../types/index.js";
import { loadYamlConfig } from "./yaml-loader.js";
import { loadOAuthProviders as loadDefaultOAuthProviders } from "./oauth-providers.js";

export interface Config {
  port: number;
  host?: string | undefined;
  logLevel: string;
  logFormat?: string | undefined;
  corsOrigins: string | string[];
  rateLimitMax: number;
  rateLimitWindowMs: number;
  saltProvider: ProviderConfig;
  oauthProviders: ReturnType<typeof loadDefaultOAuthProviders>;
}

function loadConfig(): Config {
  const appConfig: AppConfig = loadYamlConfig();

  return {
    port: appConfig.server.port,
    host: appConfig.server.host,
    logLevel: appConfig.logging.level,
    logFormat: appConfig.logging.format,
    corsOrigins: appConfig.security.corsOrigins,
    rateLimitMax: appConfig.security.rateLimitMax,
    rateLimitWindowMs: appConfig.security.rateLimitWindowMs ?? 60000,
    saltProvider: appConfig.provider,
    oauthProviders: appConfig.oauth ?? loadDefaultOAuthProviders(),
  };
}

export const config = loadConfig();

export type { AppConfig } from "../types/index.js";
