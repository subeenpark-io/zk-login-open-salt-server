import type { HealthCheckResult, HybridProviderConfig, SaltProvider } from "../types/index.js";
import { LocalProvider } from "./local.provider.js";
import { RemoteProvider } from "./remote.provider.js";
import { logger } from "../utils/logger.js";

export class HybridProvider implements SaltProvider {
  readonly name = "hybrid";
  readonly type = "hybrid";
  private primary: LocalProvider;
  private fallback: RemoteProvider;
  private fallbackEnabled: boolean;
  private fallbackAfterSeconds: number;
  private primaryFailedAt: number | null = null;

  private constructor(
    primary: LocalProvider,
    fallback: RemoteProvider,
    fallbackEnabled: boolean,
    fallbackAfterSeconds: number
  ) {
    this.primary = primary;
    this.fallback = fallback;
    this.fallbackEnabled = fallbackEnabled;
    this.fallbackAfterSeconds = fallbackAfterSeconds;
  }

  static async create(config: HybridProviderConfig): Promise<HybridProvider> {
    const primary = await LocalProvider.create(config.primary);
    const fallback = new RemoteProvider(config.fallback);

    return new HybridProvider(
      primary,
      fallback,
      config.fallbackEnabled,
      config.fallbackAfterSeconds
    );
  }

  async getSalt(sub: string, aud: string, jwt?: string): Promise<string> {
    if (this.shouldUseFallback()) {
      logger.info("Using fallback provider due to recent primary failure");
      return this.fallback.getSalt(sub, aud, jwt);
    }

    try {
      const salt = await this.primary.getSalt(sub, aud);
      this.primaryFailedAt = null;
      return salt;
    } catch (error) {
      this.primaryFailedAt = Date.now();
      logger.error("Primary provider failed", { error });

      if (this.fallbackEnabled) {
        logger.info("Falling back to remote provider");
        return this.fallback.getSalt(sub, aud, jwt);
      }

      throw error;
    }
  }

  private shouldUseFallback(): boolean {
    if (!this.fallbackEnabled || this.primaryFailedAt === null) {
      return false;
    }

    const elapsedSeconds = (Date.now() - this.primaryFailedAt) / 1000;
    return elapsedSeconds < this.fallbackAfterSeconds;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const primaryHealth = await this.primary.healthCheck();
    if (primaryHealth.healthy) {
      return primaryHealth;
    }

    if (this.fallbackEnabled) {
      return this.fallback.healthCheck();
    }

    return primaryHealth;
  }

  async destroy(): Promise<void> {
    await Promise.all([this.primary.destroy(), this.fallback.destroy()]);
  }
}
