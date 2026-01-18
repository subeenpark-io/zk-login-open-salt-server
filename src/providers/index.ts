import type { SaltProviderConfig } from "../config/salt-providers.js";

export interface SaltProvider {
  name: string;
  getSalt(sub: string, aud: string): Promise<string>;
  healthCheck(): Promise<boolean>;
  destroy(): Promise<void>;
}

export { LocalProvider } from "./local.provider.js";
export { RemoteProvider } from "./remote.provider.js";
export { HybridProvider } from "./hybrid.provider.js";
export { RouterProvider } from "./router.provider.js";

export async function createProvider(config: SaltProviderConfig): Promise<SaltProvider> {
  switch (config.type) {
    case "local": {
      const { LocalProvider } = await import("./local.provider.js");
      return LocalProvider.create(config);
    }
    case "remote": {
      const { RemoteProvider } = await import("./remote.provider.js");
      return new RemoteProvider(config);
    }
    case "hybrid": {
      const { HybridProvider } = await import("./hybrid.provider.js");
      return HybridProvider.create(config);
    }
    case "router": {
      const { RouterProvider } = await import("./router.provider.js");
      return RouterProvider.create(config);
    }
    default:
      throw new Error(`Unknown provider type: ${(config as { type: string }).type}`);
  }
}
