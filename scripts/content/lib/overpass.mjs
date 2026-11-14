// OpenStreetMap Overpass client: one request at a time, cached by query text, mirrors as fallback.
import { request, sleep } from './http.mjs';

// the main instance first; public mirrors when it is at capacity (same generic User-Agent, same cache)
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * POSTs an Overpass QL query and returns the parsed JSON (cached by query text, whichever instance answered).
 * Options: refresh, label (for log lines), timeoutMs per attempt, rounds over the instance list.
 */
export async function overpass(query, { refresh = false, label = '', timeoutMs = 600_000, rounds = 3 } = {}) {
  let lastError;
  for (let round = 0; round < rounds; round++) {
    for (const endpoint of ENDPOINTS) {
      try {
        const res = await request(endpoint, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          bucket: 'overpass',
          cacheKey: query,
          throttleKey: 'overpass',
          minIntervalMs: 5000,
          timeoutMs,
          retries: 2,
          refresh,
          validate: (v) => {
            if (!Array.isArray(v.elements)) throw new Error('Overpass answer has no elements');
            if (v.remark && /timed out|out of memory|runtime error/i.test(v.remark)) {
              throw new Error(`Overpass remark: ${v.remark}`);
            }
          },
        });
        return res;
      } catch (err) {
        lastError = err;
        process.stderr.write(`  overpass ${label} failed on ${new URL(endpoint).host}: ${err.message.slice(0, 160)}\n`);
        await sleep(15_000 * (round + 1));
      }
    }
  }
  throw lastError;
}

/** Way members of a relation element fetched with `out geom`, as [{ id, role, coords }]. */
export function relationWays(rel) {
  return (rel.members ?? [])
    .filter((m) => m.type === 'way' && Array.isArray(m.geometry))
    .map((m) => ({
      id: m.ref,
      role: m.role ?? '',
      coords: m.geometry.filter(Boolean).map((g) => [g.lon, g.lat]),
    }))
    .filter((w) => w.coords.length >= 2);
}
