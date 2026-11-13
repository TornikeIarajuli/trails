// Step 1 — snapshot the published catalogue from the app's public API (GET only).
// Output: content/snapshot/production-<local date>.json — the baseline every later step diffs against.
// Each trail holds its table columns (geometry as GeoJSON) plus its trail_checkpoints and
// trail_media rows with their ids, which is enough to recreate the rows elsewhere
// (see snapshot-to-sql.mjs).
//
//   node scripts/content/01-snapshot.mjs [--api https://host/api] [--refresh]
import path from 'node:path';
import { request } from './lib/http.mjs';
import { SNAPSHOT_DIR, writeJson } from './lib/paths.mjs';

const args = process.argv.slice(2);
const apiArg = args.indexOf('--api');
const API = (apiArg >= 0 ? args[apiArg + 1] : process.env.TRAILS_API_URL) ?? 'https://trails-en04.onrender.com/api';
const refresh = args.includes('--refresh');

// The API rate-limits to 60 requests/minute per endpoint; stay well under 40/min.
const common = { bucket: 'api', minIntervalMs: 1700, timeoutMs: 120_000, retries: 5, refresh };

// Fields the detail endpoint computes on the fly; everything else is a column of `trails`.
const COMPUTED = ['avg_rating', 'review_count', 'conditions_count', 'recent_conditions', 'photos_count'];

const list = [];
for (let page = 1; ; page++) {
  const res = await request(`${API}/trails?limit=500&page=${page}`, common);
  list.push(...res.data);
  const total = res.pagination?.total ?? list.length;
  if (list.length >= total || !res.data.length) break;
}
console.log(`list: ${list.length} published trails`);

const trails = [];
const apiStats = {};
for (const [i, row] of list.entries()) {
  const detail = await request(`${API}/trails/${row.id}`, common);
  const { media = [], checkpoints = [], ...rest } = detail;
  const columns = {};
  const stats = {};
  for (const [k, v] of Object.entries(rest)) (COMPUTED.includes(k) ? stats : columns)[k] = v;
  trails.push({ ...columns, checkpoints, media });
  apiStats[row.id] = stats;
  if ((i + 1) % 20 === 0) console.log(`  detail ${i + 1}/${list.length}`);
}
trails.sort((a, b) => a.id.localeCompare(b.id));

const now = new Date();
const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
const out = path.join(SNAPSHOT_DIR, `production-${date}.json`);
writeJson(out, {
  source: `${API}/trails`,
  fetched_at: now.toISOString(),
  note: 'Published trails only (the public API does not list unpublished ones). Geometry is GeoJSON [lng, lat]. Each trail = the columns of public.trails plus its trail_checkpoints and trail_media rows.',
  trail_count: trails.length,
  checkpoint_count: trails.reduce((n, t) => n + t.checkpoints.length, 0),
  media_count: trails.reduce((n, t) => n + t.media.length, 0),
  trails,
  api_stats: apiStats,
});
console.log(`wrote ${out}: ${trails.length} trails`);
