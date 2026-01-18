import type { SaltProvider } from "./index.js";
import type { RemoteProviderConfig } from "../config/salt-providers.js";

export class RemoteProvider implements SaltProvider {
  readonly name = "remote";
  private config: RemoteProviderConfig;

  constructor(config: RemoteProviderConfig) {
    this.config = config;
  }

  async getSalt(sub: string, aud: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.config.timeout ?? 10000);

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
        body: JSON.stringify({ sub, aud }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Remote salt server returned ${response.status.toString()}`);
      }

      const data = (await response.json()) as { salt: string };
      return data.salt;
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.config.endpoint.replace("/get_salt", "/health"), {
        method: "GET",
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async destroy(): Promise<void> {
    // No cleanup needed for remote provider
  }
}
