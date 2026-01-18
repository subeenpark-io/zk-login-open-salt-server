import type { Context, Next } from "hono";

declare module "hono" {
  interface ContextVariableMap {
    tenantId: string | undefined;
  }
}

export async function tenantMiddleware(c: Context, next: Next): Promise<void> {
  // Extract tenant ID from various sources
  const tenantId =
    c.req.header("x-tenant-id") ?? c.req.query("tenant_id") ?? extractTenantFromHost(c);

  c.set("tenantId", tenantId);

  await next();
}

function extractTenantFromHost(c: Context): string | undefined {
  const host = c.req.header("host");
  if (!host) {
    return undefined;
  }

  // Extract subdomain as tenant ID
  // e.g., "tenant1.salt.example.com" -> "tenant1"
  const parts = host.split(".");
  if (parts.length >= 3) {
    return parts[0];
  }

  return undefined;
}
