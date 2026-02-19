/**
 * Lightweight in-memory TTL cache for serverless functions.
 * Each entry expires after `ttlMs` milliseconds.
 * Safe for concurrent reads — writes are synchronous (JS single-threaded).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  size(): number {
    return this.store.size;
  }
}

// 60-second cache for slow-changing company context data
// (StyleProfile, CompanyInfo, PromptTemplate, Lessons, VaultDocs, ContentPosts)
export const generationContextCache = new TtlCache<unknown>(60_000);

// 5-minute cache for company info used in health/settings pages
export const companyCache = new TtlCache<unknown>(300_000);
