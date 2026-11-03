interface RateLimit {
  /** Hits allowed within the window; the next one is refused. */
  limit: number;
  windowMs: number;
}

interface RateLimiterOptions extends RateLimit {
  clock: () => Date;
  /** Keys kept at most, so many distinct emails or addresses cannot exhaust memory. */
  maxKeys?: number;
}

const DEFAULT_MAX_KEYS = 10_000;

/**
 * Sliding-window limiter: a key is blocked while it has `limit` hits within the last `windowMs`.
 * It keeps at most `limit` timestamps per key and lives in this process, which fits a
 * single-node app; several nodes would need a shared store.
 */
function createRateLimiter(options: RateLimiterOptions) {
  const { limit, windowMs, clock } = options;
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  const hits = new Map<string, number[]>();

  /** The key's hits that are still inside the window; drops the key when none are. */
  function current(key: string, now: number): number[] {
    const recent = (hits.get(key) ?? []).filter((at) => at > now - windowMs);
    if (recent.length === 0) hits.delete(key);
    else hits.set(key, recent);
    return recent;
  }

  function evict(now: number): void {
    for (const key of [...hits.keys()]) current(key, now);
    // Still too many: drop the keys that were inserted first.
    for (const key of hits.keys()) {
      if (hits.size <= maxKeys) break;
      hits.delete(key);
    }
  }

  return {
    /** 0 when the key may go ahead, otherwise the seconds until its oldest hit leaves. */
    retryAfterSeconds(key: string): number {
      const now = clock().getTime();
      const recent = current(key, now);
      if (recent.length < limit) return 0;
      return Math.ceil((recent[recent.length - limit]! + windowMs - now) / 1000);
    },
    hit(key: string): void {
      const now = clock().getTime();
      const recent = [...current(key, now), now].slice(-limit);
      hits.delete(key); // re-insert, so the map stays ordered by last activity
      hits.set(key, recent);
      if (hits.size > maxKeys) evict(now);
    },
    /** Takes back the latest hit, e.g. when the attempt turned out to be a successful login. */
    forgive(key: string): void {
      const recent = hits.get(key);
      if (recent === undefined) return;
      recent.pop();
      if (recent.length === 0) hits.delete(key);
    },
    reset(key: string): void {
      hits.delete(key);
    },
    size: (): number => hits.size,
  };
}

type RateLimiter = ReturnType<typeof createRateLimiter>;

export { createRateLimiter };
export type { RateLimit, RateLimiter };
