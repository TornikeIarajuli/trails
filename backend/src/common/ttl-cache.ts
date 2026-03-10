/**
 * Produce a deterministic JSON string regardless of property insertion order.
 * Ensures {a:1,b:2} and {b:2,a:1} yield the same cache key.
 */
export function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return String(obj);
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + sorted.map((k) => JSON.stringify(k) + ':' + stableStringify((obj as Record<string, unknown>)[k])).join(',') + '}';
}

/**
 * Simple in-process TTL cache. No external dependencies.
 * Entries expire after `ttlMs` milliseconds from the time they were set.
 */
export class TtlCache<T = unknown> {
  private store = new Map<string, { value: T; expiresAt: number }>();

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
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
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
