export interface SaltClientOptions {
  endpoint?: string;
  timeout?: number;
  seed?: string;
}

export interface SaltResponse {
  salt: string;
}

export class SaltClient {
  private endpoint: string;
  private timeout: number;
  private seed?: string;

  constructor(options: SaltClientOptions = {}) {
    this.endpoint = options.endpoint ?? "https://salt.api.mystenlabs.com/get_salt";
    this.timeout = options.timeout ?? 10000;
    this.seed = options.seed;
  }

  /**
   * Create a client that uses Mysten Labs' salt server.
   */
  static mysten(): SaltClient {
    return new SaltClient({
      endpoint: "https://salt.api.mystenlabs.com/get_salt",
    });
  }

  /**
   * Create a client that uses a local seed.
   * Note: This should only be used server-side.
   */
  static local(options: { seed: string }): SaltClient {
    return new SaltClient({
      seed: options.seed,
    });
  }

  /**
   * Create a client that uses a custom salt server.
   */
  static custom(endpoint: string): SaltClient {
    return new SaltClient({ endpoint });
  }

  /**
   * Get salt for a JWT.
   */
  async getSalt(jwt: string): Promise<SaltResponse> {
    if (this.seed) {
      return this.getSaltLocal(jwt);
    }

    return this.getSaltRemote(jwt);
  }

  private async getSaltRemote(jwt: string): Promise<SaltResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeout);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jwt }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: string; message?: string };
        throw new SaltError(
          error.error ?? "unknown_error",
          error.message ?? `Request failed with status ${response.status.toString()}`
        );
      }

      return (await response.json()) as SaltResponse;
    } catch (error) {
      if (error instanceof SaltError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new SaltError("timeout", "Request timed out");
      }

      throw new SaltError("network_error", "Failed to connect to salt server");
    } finally {
      clearTimeout(timeout);
    }
  }

  private getSaltLocal(_jwt: string): Promise<SaltResponse> {
    // TODO: Implement local salt derivation
    // This requires parsing the JWT and deriving salt from seed
    throw new SaltError("not_implemented", "Local salt derivation not yet implemented in SDK");
  }
}

export class SaltError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "SaltError";
  }
}
