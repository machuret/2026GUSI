/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window per identifier (userId or IP).
 * Resets automatically — no external dependency required.
 *
 * Limits:
 *  - generate / generate-ab: 20 requests per 60 seconds per user
 *  - generate-bulk: 5 requests per 60 seconds per user
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
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

// Periodically clean up expired entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  Array.from(store.entries()).forEach(([key, win]) => {
    if (now > win.resetAt) store.delete(key);
  });
}, 60_000);

export const RATE_LIMITS = {
  generate:      { limit: 20, windowMs: 60_000 },
  generateBulk:  { limit: 5,  windowMs: 60_000 },
  grantsAI:      { limit: 30, windowMs: 60_000 },
} as const;
