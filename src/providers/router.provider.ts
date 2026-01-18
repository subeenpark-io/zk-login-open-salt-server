import type { SaltProvider } from "./index.js";
import type {
  RouterProviderConfig,
  RouterRule,
  LocalProviderConfig,
  RemoteProviderConfig,
} from "../config/salt-providers.js";
import { LocalProvider } from "./local.provider.js";
import { RemoteProvider } from "./remote.provider.js";
import { logger } from "../utils/logger.js";

export class RouterProvider implements SaltProvider {
  readonly name = "router";
  private providers: Map<string, SaltProvider>;
  private routes: RouterRule[];
  private defaultProvider: string;

  private constructor(
    providers: Map<string, SaltProvider>,
    routes: RouterRule[],
    defaultProvider: string
  ) {
    this.providers = providers;
    this.routes = routes;
    this.defaultProvider = defaultProvider;
  }

  static async create(config: RouterProviderConfig): Promise<RouterProvider> {
    const providers = new Map<string, SaltProvider>();

    for (const [name, providerConfig] of Object.entries(config.providers)) {
      const provider = await createProviderFromConfig(providerConfig);
      providers.set(name, provider);
    }

    return new RouterProvider(providers, config.routes, config.defaultProvider);
  }

  async getSalt(sub: string, aud: string): Promise<string> {
    const providerName = this.resolveProvider(aud);
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    logger.debug("Routing to provider", { provider: providerName, aud });
    return provider.getSalt(sub, aud);
  }

  private resolveProvider(aud: string): string {
    for (const rule of this.routes) {
      if (this.matchesRule(rule, aud)) {
        return rule.provider;
      }
    }

    return this.defaultProvider;
  }

  private matchesRule(rule: RouterRule, aud: string): boolean {
    if (rule.match.audience) {
      const pattern = rule.match.audience.replace(/\*/g, ".*");
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(aud)) {
        return true;
      }
    }

    return false;
  }

  async healthCheck(): Promise<boolean> {
    const results = await Promise.all(
      Array.from(this.providers.values()).map((p) => p.healthCheck())
    );
    return results.some((r) => r);
  }

  async destroy(): Promise<void> {
    await Promise.all(Array.from(this.providers.values()).map((p) => p.destroy()));
  }
}

async function createProviderFromConfig(
  config: LocalProviderConfig | RemoteProviderConfig
): Promise<SaltProvider> {
  if (config.type === "local") {
    return LocalProvider.create(config);
  }
  return new RemoteProvider(config);
}
