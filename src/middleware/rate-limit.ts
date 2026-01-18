import type { Context, Next } from "hono";
import { config } from "../config/index.js";
import type { ErrorResponse } from "../types/index.js";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, config.rateLimitWindowMs);
}

export function stopCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}

startCleanup();

export async function rateLimitMiddleware(c: Context, next: Next): Promise<Response | void> {
  const clientIp = getClientIp(c);
  const now = Date.now();
  const windowMs = config.rateLimitWindowMs;
  const maxRequests = config.rateLimitMax;

  let entry = rateLimitStore.get(clientIp);

  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    };
  }

  entry.count++;
  rateLimitStore.set(clientIp, entry);

  const remaining = Math.max(0, maxRequests - entry.count);
  const resetSeconds = Math.ceil(entry.resetAt / 1000);
  const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);

  c.header("X-RateLimit-Limit", maxRequests.toString());
  c.header("X-RateLimit-Remaining", remaining.toString());
  c.header("X-RateLimit-Reset", resetSeconds.toString());

  if (entry.count > maxRequests) {
    c.header("Retry-After", retryAfterSeconds.toString());
    return c.json<ErrorResponse>(
      {
        error: "rate_limit_exceeded",
        message: "Too many requests, please try again later",
      },
      429
    );
  }

  await next();
}

function getClientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = c.req.header("x-real-ip");
  if (realIp) return realIp;

  const cfConnectingIp = c.req.header("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp;

  return "unknown";
}
