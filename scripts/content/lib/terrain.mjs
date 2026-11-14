// Terrain facts along a route from OpenStreetMap: SAC grades and surfaces of the ways the route follows,
// fords, drinking water and shelters near it. Pure functions; 12-terrain.mjs does the fetching.
//
// The result is the `trails.terrain` contract (migration 053):
//   { source, fetched_at, coverage, max_sac, sac_km, surfaces_km, fords, water_points, shelters }
import { LineIndex, haversineM, projector, sampleAlong } from './geo.mjs';

export const SAC_GRADES = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
const SAC_VALUES = {
  hiking: 'T1',
  mountain_hiking: 'T2',
  demanding_mountain_hiking: 'T3',
  alpine_hiking: 'T4',
  demanding_alpine_hiking: 'T5',
  difficult_alpine_hiking: 'T6',
};
export const SURFACE_BUCKETS = ['paved', 'gravel', 'ground', 'grass', 'rock', 'other'];
const SURFACE_VALUES = {
  paved: ['asphalt', 'concrete', 'paved', 'paving_stones', 'sett', 'cobblestone', 'metal', 'wood'],
  gravel: ['gravel', 'fine_gravel', 'compacted', 'unpaved', 'pebblestone'],
  ground: ['ground', 'dirt', 'earth', 'mud', 'sand', 'soil'],
  grass: ['grass', 'grass_paver', 'meadow'],
  rock: ['rock', 'bare_rock', 'stone', 'scree', 'shingle'],
};
/** highway values a hiking route can follow (paths, tracks and minor roads) */
export const ROUTE_HIGHWAYS = [
  'path', 'footway', 'track', 'bridleway', 'steps', 'cycleway', 'pedestrian',
  'unclassified', 'residential', 'service', 'tertiary', 'living_street',
];
export const TERRAIN_KEYS = ['source', 'fetched_at', 'coverage', 'max_sac', 'sac_km', 'surfaces_km', 'fords', 'water_points', 'shelters'];

export const DEFAULTS = {
  stepM: 20, // route sampled every 20 m
  matchM: 20, // a sample follows the nearest way within 20 m
  minSacM: 100, // max_sac needs at least 100 m of that grade
  fordM: 25,
  fordClusterM: 100,
  waterM: 100,
  waterClusterM: 50,
  shelterM: 200,
  shelterClusterM: 100,
};

// ---------- fetching: a grid of small boxes along the routes ----------
// Overpass is asked for boxes, not for a corridor around a polyline: the polyline form of `around` was found
// returning nothing on the main instance, and boxes shared by nearby trails are fetched once. A route touches
// every 0.02° cell within GRID.bufferM of it (more than the largest search distance); the cells are fetched a
// 0.2° block at a time, as boxes merged along each row. Distances are applied locally afterwards.
export const GRID = { cellDeg: 0.02, blockDeg: 0.2, bufferM: 250 };
const M_PER_DEG = (6371000 * Math.PI) / 180;

/** Keys "x,y" of the grid cells within bufferM of the line (sampled every 25 m). */
export function cellsNear(line, { cellDeg, bufferM } = GRID) {
  const cells = new Set();
  const pts = line.length >= 2 ? sampleAlong(line, 25).map((s) => s.p).concat([line[line.length - 1]]) : line;
  for (const [lon, lat] of pts) {
    const dLat = bufferM / M_PER_DEG;
    const dLon = bufferM / (M_PER_DEG * Math.cos((lat * Math.PI) / 180));
    for (let y = Math.floor((lat - dLat) / cellDeg); y <= Math.floor((lat + dLat) / cellDeg); y++)
      for (let x = Math.floor((lon - dLon) / cellDeg); x <= Math.floor((lon + dLon) / cellDeg); x++) cells.add(`${x},${y}`);
  }
  return cells;
}

/** The block a cell belongs to, as "x,y" in block units. */
export function blockOf(cell, { cellDeg, blockDeg } = GRID) {
  const [x, y] = cell.split(',').map(Number);
  const per = Math.round(blockDeg / cellDeg);
  return `${Math.floor(x / per)},${Math.floor(y / per)}`;
}

/** Overpass query for a set of cells: hiking ways, fords, water points and shelters in them (explicit tag filters). */
export function cellsQuery(cells, { cellDeg } = GRID) {
  const rows = new Map();
  for (const c of cells) {
    const [x, y] = c.split(',').map(Number);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push(x);
  }
  const boxes = [];
  for (const y of [...rows.keys()].sort((a, b) => a - b)) {
    const xs = [...new Set(rows.get(y))].sort((a, b) => a - b);
    let start = xs[0];
    for (let i = 1; i <= xs.length; i++) {
      if (i < xs.length && xs[i] === xs[i - 1] + 1) continue;
      const f = (v) => Number((v * cellDeg).toFixed(6));
      boxes.push(`(${f(y)},${f(start)},${f(y + 1)},${f(xs[i - 1] + 1)})`);
      start = xs[i];
    }
  }
  const each = (stmt) => boxes.map((b) => `  ${stmt.replace('BOX', b)}`);
  return [
    '[out:json][timeout:600];',
    '(',
    ...each(`way BOX[highway~"^(${ROUTE_HIGHWAYS.join('|')})$"];`),
    ');',
    'out tags geom qt;',
    '(',
    ...each('node BOX[ford][ford!=no];'),
    ...each('way BOX[ford][ford!=no];'),
    ');',
    'out tags geom qt;',
    '(',
    ...each('nwr BOX[amenity~"^(drinking_water|water_point|shelter)$"];'),
    ...each('nwr BOX[natural=spring];'),
    ...each('nwr BOX[man_made=water_tap];'),
    ...each('nwr BOX[tourism~"^(alpine_hut|wilderness_hut)$"];'),
    ');',
    'out tags center qt;',
  ].join('\n').replace(/(way|node|nwr) \(/g, '$1(');
}

/** sac_scale value → T1…T6 (the highest of a `;` list), or null. */
export function sacGrade(value) {
  if (!value) return null;
  let best = null;
  for (const raw of String(value).split(';')) {
    const v = raw.trim().toLowerCase();
    const g = SAC_VALUES[v] ?? (/^t[1-6]$/.test(v) ? v.toUpperCase() : null);
    if (g && (!best || g > best)) best = g;
  }
  return best;
}

/** surface value → one of SURFACE_BUCKETS, or null when the way has no surface tag. */
export function surfaceBucket(value) {
  if (!value) return null;
  const v = String(value).split(';')[0].trim().toLowerCase();
  const base = v.split(':')[0]; // concrete:plates, cobblestone:flattened, paving_stones:30 …
  for (const [bucket, values] of Object.entries(SURFACE_VALUES)) if (values.includes(base)) return bucket;
  return 'other';
}

/** Overpass elements → the four kinds of features this module uses (duplicates merged by type/id). */
export function classifyElements(elements) {
  const seen = new Map();
  for (const e of elements ?? []) {
    const key = `${e.type}/${e.id}`;
    const prev = seen.get(key);
    seen.set(key, prev ? { ...prev, ...e, tags: { ...prev.tags, ...e.tags }, geometry: e.geometry ?? prev.geometry, center: e.center ?? prev.center } : e);
  }
  const coordOf = (e) => (e.type === 'node' ? [e.lon, e.lat] : e.center ? [e.center.lon, e.center.lat] : null);
  const lineOf = (e) => (Array.isArray(e.geometry) ? e.geometry.filter(Boolean).map((g) => [g.lon, g.lat]) : null);
  const out = { ways: [], fords: [], waters: [], shelters: [] };
  for (const e of seen.values()) {
    const t = e.tags ?? {};
    if (e.type === 'way' && ROUTE_HIGHWAYS.includes(t.highway)) {
      const coords = lineOf(e);
      if (coords && coords.length >= 2) out.ways.push({ id: e.id, tags: t, coords });
    }
    if (t.ford && t.ford !== 'no' && e.type !== 'relation') {
      const coords = e.type === 'node' ? [[e.lon, e.lat]] : lineOf(e);
      if (coords?.length) out.fords.push({ type: e.type, id: e.id, tags: t, coords });
    }
    const water =
      ['drinking_water', 'water_point'].includes(t.amenity) || t.natural === 'spring' || t.man_made === 'water_tap';
    // a spring or tap mapped as not drinkable is no water point
    if (water && t.drinking_water !== 'no' && coordOf(e)) out.waters.push({ type: e.type, id: e.id, tags: t, coord: coordOf(e) });
    // bus-stop shelters are no shelter on a hike
    const shelter =
      (t.amenity === 'shelter' && t.shelter_type !== 'public_transport') || ['alpine_hut', 'wilderness_hut'].includes(t.tourism);
    if (shelter && coordOf(e)) out.shelters.push({ type: e.type, id: e.id, tags: t, coord: coordOf(e) });
  }
  return out;
}

function segDist2(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = a[0] + t * dx - p[0];
  const y = a[1] + t * dy - p[1];
  return x * x + y * y;
}

/** Nearest way to a point: a grid over the ways' segments in a local metric projection. */
export class WayIndex {
  constructor(ways, proj, cellM = 50) {
    this.proj = proj;
    this.cell = cellM;
    this.ways = ways;
    this.segs = [];
    this.grid = new Map();
    ways.forEach((w, wi) => {
      const pts = w.coords.map(proj.fwd);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const s = this.segs.push({ wi, a, b }) - 1;
        const x0 = Math.floor(Math.min(a[0], b[0]) / cellM);
        const x1 = Math.floor(Math.max(a[0], b[0]) / cellM);
        const y0 = Math.floor(Math.min(a[1], b[1]) / cellM);
        const y1 = Math.floor(Math.max(a[1], b[1]) / cellM);
        for (let x = x0; x <= x1; x++)
          for (let y = y0; y <= y1; y++) {
            const k = `${x},${y}`;
            let arr = this.grid.get(k);
            if (!arr) this.grid.set(k, (arr = []));
            arr.push(s);
          }
      }
    });
  }

  /** { way, d } for the nearest way within maxM of [lon, lat], or null. */
  nearest(p, maxM) {
    const q = this.proj.fwd(p);
    const r = Math.ceil(maxM / this.cell);
    const cx = Math.floor(q[0] / this.cell);
    const cy = Math.floor(q[1] / this.cell);
    let best = Infinity;
    let bestW = -1;
    for (let x = cx - r; x <= cx + r; x++)
      for (let y = cy - r; y <= cy + r; y++) {
        const arr = this.grid.get(`${x},${y}`);
        if (!arr) continue;
        for (const s of arr) {
          const seg = this.segs[s];
          const d2 = segDist2(q, seg.a, seg.b);
          if (d2 < best) {
            best = d2;
            bestW = seg.wi;
          }
        }
      }
    const d = Math.sqrt(best);
    return bestW >= 0 && d <= maxM ? { way: this.ways[bestW], d } : null;
  }
}

/** The line cut into pieces of at most stepM: [{ p: midpoint [lon, lat], len }]; the lengths add up to the line. */
export function pieces(coords, stepM) {
  const out = [];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const segLen = haversineM(a, b);
    if (!(segLen > 0)) continue;
    const n = Math.max(1, Math.ceil(segLen / stepM));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      out.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], len: segLen / n });
    }
  }
  return out;
}

/** Number of groups when points closer than maxM (directly or through others) count as one. */
export function clusterCount(points, maxM) {
  const parent = points.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++)
      if (haversineM(points[i], points[j]) <= maxM) parent[find(i)] = find(j);
  return new Set(points.map((_, i) => find(i))).size;
}

/** Closest point of a feature (one node or a way) to the route, if within maxM: { p, d }. */
function featureHit(coords, routeIndex, maxM) {
  const pts = [];
  if (coords.length === 1) pts.push(coords[0]);
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const n = Math.max(1, Math.ceil(haversineM(a, b) / 5));
    for (let k = 0; k <= n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  let best = null;
  for (const p of pts) {
    const d = routeIndex.distanceWithin(p, maxM);
    if (d !== Infinity && (!best || d < best.d)) best = { p, d };
  }
  return best;
}

const km1 = (m) => Math.round(m / 100) / 10;
const KEPT_TAGS = ['ford', 'highway', 'waterway', 'bridge', 'amenity', 'natural', 'man_made', 'tourism', 'shelter_type', 'drinking_water', 'name', 'name:en'];
const pick = (tags = {}) => Object.fromEntries(KEPT_TAGS.filter((k) => tags[k] != null).map((k) => [k, tags[k]]));

/**
 * route: [[lon, lat], …] (the line to describe); osm: classifyElements() output;
 * fetchedAt: 'YYYY-MM-DD' of the OSM data. Returns { terrain, details }.
 */
export function computeTerrain(route, osm, fetchedAt, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const line = route.filter((c, i) => i === 0 || c[0] !== route[i - 1][0] || c[1] !== route[i - 1][1]);
  const empty = {
    terrain: { source: 'osm', fetched_at: fetchedAt, coverage: 0, max_sac: null, sac_km: {}, surfaces_km: {}, fords: 0, water_points: 0, shelters: 0 },
    details: { length_m: 0, matched_m: 0, sac_m: {}, surface_m: {}, no_surface_m: 0, sac_ways: {}, fords: [], waters: [], shelters: [] },
  };
  if (line.length < 2) return empty;
  const proj = projector(line[Math.floor(line.length / 2)][1]);
  const index = new WayIndex(osm.ways, proj);
  let total = 0;
  let matched = 0;
  let noSurface = 0;
  const sacM = {};
  const surfM = {};
  const sacWays = {}; // grade -> { wayId: metres }, to look at where a grade comes from
  for (const piece of pieces(line, o.stepM)) {
    total += piece.len;
    const hit = index.nearest(piece.p, o.matchM);
    if (!hit) continue;
    matched += piece.len;
    const g = sacGrade(hit.way.tags.sac_scale);
    if (g) {
      sacM[g] = (sacM[g] ?? 0) + piece.len;
      sacWays[g] ??= {};
      sacWays[g][hit.way.id] = (sacWays[g][hit.way.id] ?? 0) + piece.len;
    }
    const s = surfaceBucket(hit.way.tags.surface);
    if (s) surfM[s] = (surfM[s] ?? 0) + piece.len;
    else noSurface += piece.len;
  }
  const routeIndex = new LineIndex(line, 200);
  const near = (list, maxM) =>
    list
      .map((f) => ({ f, hit: featureHit(f.coords ?? [f.coord], routeIndex, maxM) }))
      .filter((x) => x.hit)
      .map((x) => ({ type: x.f.type, id: x.f.id, p: x.hit.p, d: Math.round(x.hit.d), tags: pick(x.f.tags) }));
  const fords = near(osm.fords, o.fordM);
  const waters = near(osm.waters, o.waterM);
  const shelters = near(osm.shelters, o.shelterM);

  const grades = SAC_GRADES.filter((g) => (sacM[g] ?? 0) >= o.minSacM);
  const kmMap = (keys, m) => Object.fromEntries(keys.map((k) => [k, km1(m[k] ?? 0)]).filter(([, v]) => v > 0));
  const terrain = {
    source: 'osm',
    fetched_at: fetchedAt,
    coverage: total > 0 ? Math.round((matched / total) * 100) / 100 : 0,
    max_sac: grades.length ? grades[grades.length - 1] : null,
    sac_km: kmMap(SAC_GRADES, sacM),
    surfaces_km: kmMap(SURFACE_BUCKETS, surfM),
    fords: clusterCount(fords.map((x) => x.p), o.fordClusterM),
    water_points: clusterCount(waters.map((x) => x.p), o.waterClusterM),
    shelters: clusterCount(shelters.map((x) => x.p), o.shelterClusterM),
  };
  const round = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round(v)]));
  return {
    terrain,
    details: {
      length_m: Math.round(total),
      matched_m: Math.round(matched),
      sac_m: round(sacM),
      surface_m: round(surfM),
      no_surface_m: Math.round(noSurface),
      sac_ways: Object.fromEntries(Object.entries(sacWays).map(([g, w]) => [g, round(w)])),
      fords,
      waters,
      shelters,
    },
  };
}

/** Problems with a `trails.terrain` value (empty list = matches the contract). */
export function terrainProblems(t) {
  const p = [];
  if (!t || typeof t !== 'object' || Array.isArray(t)) return ['terrain must be an object'];
  const keys = Object.keys(t);
  const missing = TERRAIN_KEYS.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !TERRAIN_KEYS.includes(k));
  if (missing.length) p.push(`terrain is missing ${missing.join(', ')}`);
  if (extra.length) p.push(`terrain has unknown keys ${extra.join(', ')}`);
  if (t.source !== 'osm') p.push('terrain.source must be "osm"');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.fetched_at ?? '')) p.push('terrain.fetched_at must be YYYY-MM-DD');
  if (typeof t.coverage !== 'number' || t.coverage < 0 || t.coverage > 1 || Math.abs(t.coverage * 100 - Math.round(t.coverage * 100)) > 1e-9) {
    p.push('terrain.coverage must be 0–1 with at most 2 decimals');
  }
  if (t.max_sac !== null && !SAC_GRADES.includes(t.max_sac)) p.push('terrain.max_sac must be T1–T6 or null');
  const kmOk = (m, allowed) =>
    m && typeof m === 'object' && !Array.isArray(m) &&
    Object.entries(m).every(([k, v]) => allowed.includes(k) && typeof v === 'number' && v > 0 && Math.abs(v * 10 - Math.round(v * 10)) < 1e-9);
  if (!kmOk(t.sac_km, SAC_GRADES)) p.push('terrain.sac_km must map T1–T6 to km > 0 with 1 decimal');
  if (!kmOk(t.surfaces_km, SURFACE_BUCKETS)) p.push(`terrain.surfaces_km must map ${SURFACE_BUCKETS.join('/')} to km > 0 with 1 decimal`);
  for (const k of ['fords', 'water_points', 'shelters']) if (!Number.isInteger(t[k]) || t[k] < 0) p.push(`terrain.${k} must be a whole number ≥ 0`);
  if (t.max_sac && !(t.sac_km?.[t.max_sac] >= 0.1)) p.push('terrain.max_sac has no km in sac_km');
  return p;
}

/** One line for the dry run: "T3, 2 fords, 1 water point, 0 shelters, 86 % on OSM ways". */
export function describeTerrain(t) {
  if (!t || typeof t !== 'object') return 'null';
  const n = (v, one, many = `${one}s`) => `${v} ${v === 1 ? one : many}`;
  return [
    t.max_sac ?? 'no SAC grade',
    n(t.fords, 'ford'),
    n(t.water_points, 'water point'),
    n(t.shelters, 'shelter'),
    `${Math.round((t.coverage ?? 0) * 100)} % on OSM ways`,
  ].join(', ');
}

/** Provenance note for a trail's terrain in trails.json. */
export function terrainNote(fetchedAt, geometry) {
  const line = geometry === 'osm-full' ? 'full-resolution OSM line of the route' : 'published route';
  return `OpenStreetMap data of ${fetchedAt}: the ${line} cut into ~${DEFAULTS.stepM} m pieces, each matched to the nearest path, track or minor road within ${DEFAULTS.matchM} m (its sac_scale and surface); fords within ${DEFAULTS.fordM} m, water points within ${DEFAULTS.waterM} m, shelters and huts within ${DEFAULTS.shelterM} m`;
}

/** JSON with object keys sorted, so two values compare equal whatever order their keys came in. */
export function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
