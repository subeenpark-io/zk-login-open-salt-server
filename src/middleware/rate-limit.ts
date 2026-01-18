import type { Context, Next } from "hono";
import { config } from "../config/index.js";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

export async function rateLimitMiddleware(c: Context, next: Next): Promise<Response | void> {
  const clientId = getClientId(c);
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxRequests = config.rateLimitMax;

  let entry = rateLimitStore.get(clientId);

  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    };
  }

  entry.count++;
  rateLimitStore.set(clientId, entry);

  // Set rate limit headers
  c.header("X-RateLimit-Limit", maxRequests.toString());
  c.header("X-RateLimit-Remaining", Math.max(0, maxRequests - entry.count).toString());
  c.header("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000).toString());

  if (entry.count > maxRequests) {
    return c.json(
      {
        error: "rate_limit_exceeded",
        message: "Too many requests, please try again later",
      },
      429
    );
  }

  await next();
}

function getClientId(c: Context): string {
  // Try to get client IP from various headers
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  const realIp = c.req.header("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}
