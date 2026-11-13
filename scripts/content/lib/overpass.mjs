// OpenStreetMap Overpass client: one request at a time, cached by query text, mirrors as fallback.
import { request, sleep } from './http.mjs';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export async function overpass(query, { refresh = false, label = '' } = {}) {
  let lastError;
  for (let round = 0; round < 3; round++) {
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
          timeoutMs: 600_000,
          retries: 2,
          refresh,
          validate: (v) => {
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
