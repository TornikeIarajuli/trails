// Step 13 — named outdoor places of Georgia from OpenStreetMap → content/places.json (public.places, migration 068).
//
//   node scripts/content/13-places.mjs [--pbf <extract.osm.pbf>] [--no-elevation]
//
// Reads Geofabrik's Georgia extract (the newest content/cache/osm/georgia-YYMMDD.osm.pbf unless --pbf; the terrain
// step in scripts/README.md says where to download it) in three streamed passes, so it never holds every node:
// relations (the places among them, and the ways they are made of), ways (the places among them, and the nodes of
// those ways and of the relations' ways), nodes (the places among them, and the coordinates of the wanted nodes).
// An area's position is the mean of its outer nodes. Which features count, their names, score and duplicates live
// in lib/places.mjs.
//
// Kept: places on Georgian-controlled ground, as for trails (not in the occupied territories, not abroad: the
// extract reaches over the border), with 300 m of slack so summits and passes on the border ridge stay. This needs
// the outlines in content/work/osm-admin.json (02-osm-fetch.mjs).
// Region: that of the nearest trail start in content/trails.json within 80 km. Elevation: the `ele` tag, else
// Open-Meteo's elevation API (100 points a request, one request a second), cached in
// content/cache/places-elevation.json; --no-elevation skips the requests (uncached places get none).
// 14-places-apply.mjs loads the result into the database.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readDataset } from './lib/dataset.mjs';
import { request } from './lib/http.mjs';
import { CACHE, CONTENT, WORK, readJsonIfExists, writeJson } from './lib/paths.mjs';
import {
  KINDS, centroid, chunk, classify, compareForOutput, dedupe, elevationKey, elevationUrl, inTerritory, nearestRegion,
  parseEle, placeNames, placeRecord, trailStarts,
} from './lib/places.mjs';
import { inGeorgia, occupiedAreaAt } from './lib/regions.mjs';

const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const pbfArg = args.indexOf('--pbf');
const skipElevation = args.includes('--no-elevation');
const OUT = path.join(CONTENT, 'places.json');
const ELEVATION_CACHE = path.join(CACHE, 'places-elevation.json');

function newestExtract() {
  const dir = path.join(CACHE, 'osm');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^georgia-\d{6}\.osm\.pbf$/.test(f)).sort() : [];
  if (!files.length) throw new Error('No georgia-YYMMDD.osm.pbf in content/cache/osm/ (see the terrain step in scripts/README.md)');
  return path.join(dir, files[files.length - 1]);
}

/** Streams the extract and hands every item of one type ('node' | 'way' | 'relation') to fn. */
function readPass(file, type, fn) {
  const parser = require('osm-pbf-parser');
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file).pipe(parser());
    stream.on('data', (batch) => {
      try {
        for (const item of batch) if (item.type === type) fn(item);
      } catch (err) {
        stream.destroy(err);
      }
    });
    stream.on('error', reject);
    stream.on('end', resolve);
  });
}

if (!fs.existsSync(path.join(WORK, 'osm-admin.json'))) {
  throw new Error('content/work/osm-admin.json is missing (country and occupied-territory outlines): run 02-osm-fetch.mjs first');
}
const pbf = pbfArg >= 0 ? path.resolve(args[pbfArg + 1]) : newestExtract();
const started = Date.now();
const elapsed = () => `${Math.round((Date.now() - started) / 1000)} s`;
console.log(`reading ${path.basename(pbf)} in three passes …`);

// ---------- 1. relations: the places among them, and their ways (inner rings left out) ----------
const relations = [];
const memberWays = new Set();
await readPass(pbf, 'relation', (rel) => {
  const kind = classify(rel.tags);
  const names = kind && placeNames(rel.tags, kind);
  if (!names) return;
  const ways = rel.members.filter((m) => m.type === 'way' && m.role !== 'inner').map((m) => m.id);
  const nodes = rel.members.filter((m) => m.type === 'node').map((m) => m.id);
  for (const id of ways) memberWays.add(id);
  relations.push({ osm_type: 'relation', osm_id: rel.id, kind, names, tags: rel.tags, ways, nodes });
});
console.log(`  relations: ${relations.length} places, ${memberWays.size} ways in them (${elapsed()})`);

// ---------- 2. ways: the places among them, and the node lists of the relations' ways ----------
const wayNodes = new Map();
const ways = [];
await readPass(pbf, 'way', (way) => {
  if (memberWays.has(way.id)) wayNodes.set(way.id, way.refs);
  const kind = classify(way.tags);
  const names = kind && placeNames(way.tags, kind);
  if (names) ways.push({ osm_type: 'way', osm_id: way.id, kind, names, tags: way.tags, refs: way.refs });
});
const wantedNodes = new Set();
for (const w of ways) for (const id of w.refs) wantedNodes.add(id);
for (const refs of wayNodes.values()) for (const id of refs) wantedNodes.add(id);
for (const r of relations) for (const id of r.nodes) wantedNodes.add(id);
console.log(`  ways: ${ways.length} places, ${wantedNodes.size} nodes wanted (${elapsed()})`);

// ---------- 3. nodes: the places among them, and the coordinates of the wanted nodes ----------
const coords = new Map();
const nodes = [];
await readPass(pbf, 'node', (node) => {
  if (wantedNodes.has(node.id)) coords.set(node.id, [node.lon, node.lat]);
  const kind = classify(node.tags);
  const names = kind && placeNames(node.tags, kind);
  if (names) nodes.push({ osm_type: 'node', osm_id: node.id, kind, names, tags: node.tags, point: [node.lon, node.lat] });
});
console.log(`  nodes: ${nodes.length} places (${elapsed()})`);

// ---------- positions ----------
/** Mean of the distinct nodes that have coordinates (a closed ring's last node is its first). */
function meanOf(nodeIds) {
  const points = [];
  for (const id of new Set(nodeIds)) {
    const c = coords.get(id);
    if (c) points.push(c);
  }
  return centroid(points);
}
const candidates = [...nodes];
let unplaced = 0;
for (const w of ways) {
  const point = meanOf(w.refs);
  if (point) candidates.push({ ...w, point });
  else unplaced++;
}
for (const r of relations) {
  const outer = r.ways.flatMap((id) => wayNodes.get(id) ?? []);
  const point = meanOf(outer.length ? outer : r.nodes);
  if (point) candidates.push({ ...r, point });
  else unplaced++;
}

// ---------- Georgian-controlled ground only ----------
const territory = { inCountry: inGeorgia, inOccupied: (p) => occupiedAreaAt(p) !== null };
const rejected = { occupied: 0, abroad: 0 };
const kept = candidates.filter((c) => {
  if (inTerritory(c.point, territory)) return true;
  rejected[occupiedAreaAt(c.point) ? 'occupied' : 'abroad']++;
  return false;
});

// ---------- region ----------
const starts = trailStarts(readDataset());
for (const c of kept) c.region = nearestRegion(c.point, starts);

// ---------- elevation ----------
const elevationCache = readJsonIfExists(ELEVATION_CACHE, {});
for (const c of kept) {
  c.elevation_m = parseEle(c.tags.ele);
  if (c.elevation_m === null) c.elevationKey = elevationKey(c.point[1], c.point[0]);
}
const missing = [...new Set(kept.filter((c) => c.elevationKey && !(c.elevationKey in elevationCache)).map((c) => c.elevationKey))];
if (missing.length && skipElevation) {
  console.log(`elevation: ${missing.length} point(s) not in the cache, skipped (--no-elevation)`);
} else if (missing.length) {
  const batches = chunk(missing, 100);
  console.log(`elevation: ${missing.length} point(s) from Open-Meteo, ${batches.length} request(s)`);
  let failed = 0;
  for (const keys of batches) {
    try {
      const res = await request(elevationUrl(keys), {
        throttleKey: 'open-meteo',
        minIntervalMs: 1000,
        timeoutMs: 30_000,
        validate: (v) => {
          if (!Array.isArray(v?.elevation) || v.elevation.length !== keys.length) throw new Error('unexpected elevation response');
        },
      });
      keys.forEach((k, i) => {
        const e = res.elevation[i];
        elevationCache[k] = typeof e === 'number' && Number.isFinite(e) ? Math.round(e) : null;
      });
      writeJson(ELEVATION_CACHE, elevationCache);
    } catch (err) {
      failed++;
      console.log(`  a request failed (${err.message.slice(0, 120)}); its places keep no elevation — run again`);
    }
  }
  if (failed) console.log(`  ${failed} of ${batches.length} request(s) failed`);
}
for (const c of kept) if (c.elevationKey) c.elevation_m = elevationCache[c.elevationKey] ?? null;

// ---------- score, duplicates, output ----------
const records = kept.map(placeRecord);
const places = dedupe(records).sort(compareForOutput);
fs.writeFileSync(OUT, `[\n${places.map((p) => JSON.stringify(p)).join(',\n')}\n]\n`);

const perKind = Object.fromEntries(KINDS.map((k) => [k, 0]));
for (const p of places) perKind[p.kind]++;
console.log(
  `places.json: ${places.length} places — of ${candidates.length} found, ${rejected.occupied} in the occupied territories and ` +
    `${rejected.abroad} abroad left out, ${records.length - places.length} duplicates merged` +
    `${unplaced ? `, ${unplaced} without coordinates in the extract` : ''} (${elapsed()})`,
);
for (const k of KINDS) console.log(`  ${k.padEnd(11)}${String(perKind[k]).padStart(6)}`);
const withElevation = places.filter((p) => p.elevation_m !== null).length;
const withRegion = places.filter((p) => p.region).length;
console.log(`  ${withElevation} with an elevation, ${withRegion} with a region, ${places.filter((p) => p.wikidata).length} with Wikidata`);
