import type { HealthCheckResult, RemoteProviderConfig, SaltProvider } from "../types/index.js";

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RETRY_COUNT = 0;

export class RemoteProvider implements SaltProvider {
  readonly name = "remote";
  readonly type = "remote";
  private config: RemoteProviderConfig;

  constructor(config: RemoteProviderConfig) {
    this.config = config;
  }

  async getSalt(sub: string, aud: string, jwt?: string): Promise<string> {
    const maxAttempts = (this.config.retryCount ?? DEFAULT_RETRY_COUNT) + 1;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.requestSalt(sub, aud, jwt);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Remote provider request failed");

        if (attempt >= maxAttempts) {
          break;
        }
      }
    }

    throw lastError ?? new Error("Remote provider request failed");
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const response = await fetch(this.endpointFor("/health"), {
        method: "GET",
      });

      if (!response.ok) {
        return {
          healthy: false,
          message: `Remote provider responded with ${response.status.toString()}`,
        };
      }

      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : "Remote provider health check failed",
      };
    }
  }

  async destroy(): Promise<void> {
    // No cleanup needed for remote provider
  }

  private async requestSalt(sub: string, aud: string, jwt?: string): Promise<string> {
    const controller = new AbortController();
    const timeoutMs = this.config.timeout ?? DEFAULT_TIMEOUT_MS;
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.config.apiKey) {
        headers["Authorization"] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ sub, aud, jwt }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = `Remote salt server returned ${response.status.toString()}`;
        throw new Error(message);
      }

      const data = (await response.json()) as { salt?: string };
      if (!data.salt) {
        throw new Error("Remote salt server response missing salt");
      }

      return data.salt;
    } finally {
      clearTimeout(timeout);
    }
  }

  private endpointFor(path: string): string {
    if (this.config.endpoint.endsWith(path)) {
      return this.config.endpoint;
    }

    if (this.config.endpoint.endsWith("/get_salt")) {
      return this.config.endpoint.replace("/get_salt", path);
    }

    return `${this.config.endpoint}${path}`;
  }
}
