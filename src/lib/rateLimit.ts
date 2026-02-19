/**
 * In-memory rate limiter with lazy TTL cleanup.
 *
 * ⚠️  SERVERLESS NOTE: This store lives in module memory. On platforms like
 * Vercel each serverless instance has its own store — limits are per-instance,
 * not global. For true global rate limiting, replace with Upstash Redis:
 * https://github.com/upstash/ratelimit
 *
 * For the current single-tenant beta this is acceptable.
 */

interface RateWindow {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateWindow>();

/** Lazily evict expired entries — called on every check, O(1) amortised. */
function evictExpired(now: number) {
  // Only scan if store is large to avoid O(n) on every request
  if (store.size < 500) return;
  Array.from(store.entries()).forEach(([key, win]) => {
    if (now > win.resetAt) store.delete(key);
  });
}

export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  evictExpired(now);

  const existing = store.get(key);

  if (!existing || now > existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count++;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/**
 * Returns standard rate-limit response headers.
 */
export function rateLimitHeaders(result: { remaining: number; resetAt: number }, limit: number) {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

export const RATE_LIMITS = {
  generate:      { limit: 20, windowMs: 60_000 },
  generateBulk:  { limit: 5,  windowMs: 60_000 },
  grantsAI:      { limit: 30, windowMs: 60_000 },
} as const;
