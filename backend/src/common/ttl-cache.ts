/**
 * Produce a deterministic JSON string regardless of property insertion order.
 * Ensures {a:1,b:2} and {b:2,a:1} yield the same cache key.
 */
export function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return String(obj);
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  return (
    '{' +
    sorted
      .map(
        (k) =>
          JSON.stringify(k) +
          ':' +
          stableStringify((obj as Record<string, unknown>)[k]),
      )
      .join(',') +
    '}'
  );
}

const DEFAULT_MAX_ENTRIES = 500;
const SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * Simple in-process TTL cache. No external dependencies.
 * Entries expire after `ttlMs` milliseconds from the time they were set.
 * The cache never holds more than `maxEntries` entries: expired entries are swept first,
 * then the oldest ones are evicted.
 */
export class TtlCache<T = unknown> {
  private store = new Map<string, { value: T; expiresAt: number }>();
  private lastSweepAt = Date.now();
  private readonly maxEntries: number;

  constructor(maxEntries: number = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = Math.max(1, Math.floor(maxEntries));
  }

  get size(): number {
    return this.store.size;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    const now = Date.now();
    // Deleting first moves a re-set key to the end of the Map's insertion order.
    this.store.delete(key);

    if (
      this.store.size >= this.maxEntries ||
      now - this.lastSweepAt >= SWEEP_INTERVAL_MS
    ) {
      this.sweep(now);
    }
    while (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next();
      if (oldest.done) break;
      this.store.delete(oldest.value);
    }

    this.store.set(key, { value, expiresAt: now + ttlMs });
  }

  /** Remove every entry that has already expired. */
  sweep(now: number = Date.now()): void {
    this.lastSweepAt = now;
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  /** Remove all entries whose keys start with the given prefix. */
  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }
}
