// Step 12 — terrain facts from OpenStreetMap along every route → trails.terrain (migration 053).
//
//   node scripts/content/12-terrain.mjs [--only <trail-id,…>] [--refresh] [--local <extract.osm.pbf>]
//
// --local reads an OpenStreetMap extract instead of asking Overpass (lib/osm-extract.mjs answers the same query
// from it), for when the public Overpass instances are at capacity: Geofabrik's Georgia extract, saved under
// content/cache/osm/ (europe/georgia-latest.osm.pbf, about 100 MB). The terrain then dates from the extract.
//
// Overpass is asked for small boxes along the routes (0.02° cells within 250 m of a route, fetched a 0.2° block per
// request, so trails that share ground share requests): the paths, tracks and minor roads in them, fords, water
// points and shelters. Requests go one at a time, are cached in content/cache/overpass and back off on 429/504.
// Each route is then cut into ~20 m pieces matched to the nearest of those ways within 20 m, and the features are
// counted by their distance to the route (lib/terrain.mjs). The line matched is the full-resolution OSM line where
// the pipeline has it (rebuilt and new trails), otherwise the published route.
//
// Writes content/work/terrain.json (with details for the report) and `terrain` into content/trails.json.
// 09-build-dataset.mjs carries that over on a rebuild as long as the route is unchanged; run this step again after
// a route changes. Order: 09 → 12 → 11 → verify.
import path from 'node:path';
import { readDataset, routeKey, writeDataset } from './lib/dataset.mjs';
import { bbox, haversineM } from './lib/geo.mjs';
import { overpass } from './lib/overpass.mjs';
import { loadExtract } from './lib/osm-extract.mjs';
import { WORK, readJsonIfExists, writeJson } from './lib/paths.mjs';
import {
  DEFAULTS, GRID, blockOf, cellsNear, cellsQuery, classifyElements, computeTerrain, terrainNote, terrainProblems,
} from './lib/terrain.mjs';

const args = process.argv.slice(2);
const onlyArg = args.indexOf('--only');
const only = onlyArg >= 0 ? new Set(args[onlyArg + 1].split(',')) : null;
const refresh = args.includes('--refresh');
const localArg = args.indexOf('--local');
const localFile = localArg >= 0 ? args[localArg + 1] : null;

const dataset = readDataset();
const existing = readJsonIfExists(path.join(WORK, 'existing-geometry.json'), {});
const fresh = readJsonIfExists(path.join(WORK, 'new-geometry.json'), { accepted: [] }).accepted;
const fullById = new Map([...Object.values(existing).map((g) => [g.id, g.full]), ...fresh.map((a) => [a.id, a.full])]);
const outFile = path.join(WORK, 'terrain.json');
const out = readJsonIfExists(outFile, { trails: {} });
out.params = { ...DEFAULTS, grid: GRID };

/** The line to describe: the full OSM line when it is the same route as the published one. */
function lineFor(t) {
  const full = fullById.get(t.id);
  const same = (a, b) => haversineM(a, b) < 1;
  if (Array.isArray(full) && full.length >= 2 && same(full[0], t.route[0]) && same(full[full.length - 1], t.route[t.route.length - 1])) {
    return { line: full, geometry: 'osm-full' };
  }
  return { line: t.route, geometry: 'published-route' };
}

// ---------- which cells, which blocks ----------
// the grid is built from every route, so a block's request stays the same whichever trails are selected
const all = dataset.trails.filter((t) => Array.isArray(t.route) && t.route.length >= 2);
const todo = all.filter((t) => !only || only.has(t.id));
const lines = new Map(all.map((t) => [t.id, lineFor(t)]));
const cellsOf = new Map(all.map((t) => [t.id, cellsNear(lines.get(t.id).line)]));
const blocks = new Map();
for (const cells of cellsOf.values()) {
  for (const c of cells) {
    const b = blockOf(c);
    if (!blocks.has(b)) blocks.set(b, new Set());
    blocks.get(b).add(c);
  }
}
const needed = new Set(todo.flatMap((t) => [...cellsOf.get(t.id)].map((c) => blockOf(c))));
const blockKeys = [...needed].sort();
console.log(`terrain: ${todo.length} trail(s), ${blockKeys.length} Overpass request(s) for ${[...needed].reduce((n, b) => n + blocks.get(b).size, 0)} cells`);

// ---------- fetch (cached), or read from a local extract ----------
let local = null;
if (localFile) {
  const started = Date.now();
  console.log(`reading ${localFile} …`);
  local = await loadExtract(localFile, { blocks: blockKeys });
  console.log(`  extract of ${local.date ?? 'unknown date'}: ${local.counts.nodes} nodes kept, ${local.counts.ways} ways, ${local.counts.points} points (${Math.round((Date.now() - started) / 1000)} s)`);
}
const store = { ways: new Map(), fords: new Map(), waters: new Map(), shelters: new Map() };
const blockDate = new Map();
const failedBlocks = new Set();
let fetched = 0;
for (const b of blockKeys) {
  let res;
  try {
    // instances under load: up to 5 minutes per attempt, six rounds over the main instance and the mirrors
    res = local
      ? local.answer(blocks.get(b))
      : await overpass(cellsQuery(blocks.get(b)), { refresh, label: `block ${b}`, timeoutMs: 300_000, rounds: 6 });
  } catch (err) {
    failedBlocks.add(b);
    console.log(`  block ${b} could not be fetched (${err.message.slice(0, 100)}) — its trails keep their previous terrain; run again`);
    continue;
  }
  blockDate.set(b, (res.osm3s?.timestamp_osm_base ?? new Date().toISOString()).slice(0, 10));
  const osm = classifyElements(res.elements);
  for (const [kind, list] of Object.entries(osm)) {
    for (const f of list) {
      const key = `${f.type ?? 'way'}/${f.id}`;
      if (!store[kind].has(key)) store[kind].set(key, { ...f, box: bbox(f.coords ?? [f.coord]) });
    }
  }
  fetched++;
  if (fetched % 10 === 0 || fetched === blockKeys.length) console.log(`  ${fetched}/${blockKeys.length} requests`);
}
console.log(`OSM: ${store.ways.size} ways, ${store.fords.size} fords, ${store.waters.size} water points, ${store.shelters.size} shelters`);

// ---------- per trail ----------
const PAD_DEG = 0.004; // > 300 m: everything within the search distances of the line
const near = (map, box) => [...map.values()].filter((f) => f.box[2] >= box[0] - PAD_DEG && f.box[0] <= box[2] + PAD_DEG && f.box[3] >= box[1] - PAD_DEG && f.box[1] <= box[3] + PAD_DEG);
let skipped = 0;
for (const t of todo) {
  if ([...cellsOf.get(t.id)].some((c) => failedBlocks.has(blockOf(c)))) {
    skipped++;
    continue;
  }
  const { line, geometry } = lines.get(t.id);
  const box = bbox(line);
  const osm = { ways: near(store.ways, box), fords: near(store.fords, box), waters: near(store.waters, box), shelters: near(store.shelters, box) };
  const dates = [...new Set([...cellsOf.get(t.id)].map((c) => blockDate.get(blockOf(c))))].sort();
  const { terrain, details } = computeTerrain(line, osm, dates[0]);
  const problems = terrainProblems(terrain);
  if (problems.length) throw new Error(`${t.id} ${t.name_en}: ${problems.join('; ')}`);
  out.trails[t.id] = {
    name: t.name_en, route_key: routeKey(t.route), geometry,
    osm_counts: { ways: osm.ways.length, fords: osm.fords.length, waters: osm.waters.length, shelters: osm.shelters.length },
    terrain, details,
  };
}
out.generated_at = new Date().toISOString();
writeJson(outFile, out);
if (skipped) console.log(`${skipped} trail(s) not recomputed: ${failedBlocks.size} block(s) could not be fetched — run again`);

// ---------- into the dataset ----------
let set = 0;
let stale = 0;
for (const t of dataset.trails) {
  const e = out.trails[t.id];
  if (e && e.route_key === routeKey(t.route)) {
    t.terrain = e.terrain;
    t.provenance = { ...t.provenance, terrain: { source: 'osm', note: terrainNote(e.terrain.fetched_at, e.geometry) } };
    set++;
  } else {
    t.terrain = null;
    if (e) stale++;
  }
}
dataset.counts = { ...dataset.counts, terrain: set };
writeDataset(dataset);
console.log(`trails.json: terrain for ${set} of ${dataset.trails.length} trails${stale ? `; ${stale} computed for an older route (run again)` : ''}`);
