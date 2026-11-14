// A local stand-in for the terrain Overpass query (lib/terrain.mjs cellsQuery), read from an OpenStreetMap
// extract (Geofabrik's Georgia .osm.pbf) when the public Overpass instances are at capacity.
//
// The extract is read once, as a stream. Nodes are kept only around the blocks the routes need (their 0.2° tiles
// and the ring of tiles around them), ways get their geometry from those nodes (split where a way leaves the kept
// area, never bridged), and every feature is indexed by the 0.02° cells it touches. answer(cells) then returns
// what the Overpass query would for those cells, in Overpass JSON form, so classifyElements and everything after
// it stay the same:
//   - ways with a hiking highway (ROUTE_HIGHWAYS), with their geometry
//   - fords (nodes, and ways with their geometry)
//   - water points and shelters (nodes, and ways with their centre)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { GRID, ROUTE_HIGHWAYS } from './terrain.mjs';

const require = createRequire(import.meta.url);

const HIGHWAYS = new Set(ROUTE_HIGHWAYS);

/** The tags the Overpass query selects on: which kinds of feature this is, or null. */
export function wantedKinds(tags) {
  if (!tags) return null;
  const highway = HIGHWAYS.has(tags.highway);
  const ford = Boolean(tags.ford) && tags.ford !== 'no';
  const water =
    ['drinking_water', 'water_point'].includes(tags.amenity) || tags.natural === 'spring' || tags.man_made === 'water_tap';
  const shelter = tags.amenity === 'shelter' || ['alpine_hut', 'wilderness_hut'].includes(tags.tourism);
  return highway || ford || water || shelter ? { highway, ford, point: water || shelter } : null;
}

const tileOf = (lon, lat, deg) => [Math.floor(lon / deg), Math.floor(lat / deg)];
const keyOf = (x, y) => `${x},${y}`;

/**
 * Builds the index item by item (nodes before ways, as in a .pbf), for the blocks given ("bx,by" 0.2° tiles).
 * add(item) takes { type, id, lat?, lon?, tags?, refs? }; finish() returns { counts, answer(cells) }.
 */
export function createIndexBuilder({ blocks, grid = GRID, date = null }) {
  const blockDeg = grid.blockDeg;
  const cellDeg = grid.cellDeg;
  const keepTiles = new Set();
  for (const b of blocks) {
    const [bx, by] = b.split(',').map(Number);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) keepTiles.add(keyOf(bx + dx, by + dy));
  }

  // Kept nodes in id order (a .pbf lists them so), for a binary search from the ways
  const nodeIds = [];
  const nodeLat = [];
  const nodeLon = [];
  const pointNodes = [];
  const ways = [];

  const findNode = (id) => {
    let lo = 0;
    let hi = nodeIds.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const v = nodeIds[mid];
      if (v === id) return mid;
      if (v < id) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  };

  function add(item) {
    if (item.type === 'node') {
      const [tx, ty] = tileOf(item.lon, item.lat, blockDeg);
      if (!keepTiles.has(keyOf(tx, ty))) return;
      if (nodeIds.length && item.id <= nodeIds[nodeIds.length - 1]) {
        throw new Error('The extract does not list nodes in id order; this reader needs that (.pbf files do)');
      }
      nodeIds.push(item.id);
      nodeLat.push(item.lat);
      nodeLon.push(item.lon);
      const kinds = wantedKinds(item.tags);
      if (kinds && (kinds.ford || kinds.point)) {
        pointNodes.push({ type: 'node', id: item.id, lat: item.lat, lon: item.lon, tags: item.tags });
      }
      return;
    }
    if (item.type !== 'way') return;
    const kinds = wantedKinds(item.tags);
    if (!kinds) return;
    const runs = [];
    let run = [];
    for (const ref of item.refs ?? []) {
      const i = findNode(ref);
      if (i < 0) {
        if (run.length) runs.push(run);
        run = [];
      } else {
        run.push([nodeLon[i], nodeLat[i]]);
      }
    }
    if (run.length) runs.push(run);
    const usable = runs.filter((r) => r.length >= (kinds.highway || kinds.ford ? 2 : 1));
    usable.forEach((coords, n) => {
      ways.push({ id: usable.length > 1 ? `${item.id}~${n}` : item.id, tags: item.tags, coords, kinds });
    });
  }

  function finish() {
    // Every feature under the 0.02° cells it touches (segments sampled finely enough not to skip a cell)
    const byCell = new Map();
    const put = (cellKey, feature) => {
      if (!byCell.has(cellKey)) byCell.set(cellKey, []);
      byCell.get(cellKey).push(feature);
    };
    const step = cellDeg / 4;
    for (const w of ways) {
      const cells = new Set();
      for (let i = 0; i < w.coords.length; i++) {
        const [lon, lat] = w.coords[i];
        cells.add(keyOf(...tileOf(lon, lat, cellDeg)));
        if (i === 0) continue;
        const [plon, plat] = w.coords[i - 1];
        const n = Math.ceil(Math.max(Math.abs(lon - plon), Math.abs(lat - plat)) / step);
        for (let k = 1; k < n; k++) {
          cells.add(keyOf(...tileOf(plon + ((lon - plon) * k) / n, plat + ((lat - plat) * k) / n, cellDeg)));
        }
      }
      const feature = { kind: 'way', way: w };
      for (const c of cells) put(c, feature);
    }
    for (const node of pointNodes) put(keyOf(...tileOf(node.lon, node.lat, cellDeg)), { kind: 'node', node });

    const timestamp = date ? `${date}T00:00:00Z` : new Date().toISOString();
    return {
      date,
      counts: { nodes: nodeIds.length, ways: ways.length, points: pointNodes.length },
      /** What the terrain Overpass query returns for these cells (a set or array of "x,y" 0.02° cell keys). */
      answer(cells) {
        const seen = new Set();
        const elements = [];
        for (const c of cells) {
          for (const f of byCell.get(c) ?? []) {
            const key = f.kind === 'way' ? `w${f.way.id}` : `n${f.node.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (f.kind === 'node') {
              elements.push(f.node);
              continue;
            }
            const w = f.way;
            const element = { type: 'way', id: w.id, tags: w.tags };
            if (w.kinds.highway || w.kinds.ford) element.geometry = w.coords.map(([lon, lat]) => ({ lat, lon }));
            if (w.kinds.point) {
              const lons = w.coords.map((p) => p[0]);
              const lats = w.coords.map((p) => p[1]);
              element.center = {
                lat: (Math.min(...lats) + Math.max(...lats)) / 2,
                lon: (Math.min(...lons) + Math.max(...lons)) / 2,
              };
            }
            elements.push(element);
          }
        }
        return { elements, osm3s: { timestamp_osm_base: timestamp } };
      },
    };
  }

  return { add, finish };
}

/** The index for a list of items (tests, small extracts). */
export function buildIndex(items, options) {
  const builder = createIndexBuilder(options);
  for (const item of items) builder.add(item);
  return builder.finish();
}

/**
 * Reads a .osm.pbf extract, as a stream, into an index for the blocks given. Geofabrik's dated file names
 * (georgia-YYMMDD.osm.pbf) give the date the data is from.
 */
export function loadExtract(file, { blocks, grid = GRID }) {
  const parser = require('osm-pbf-parser');
  const m = /-(\d{2})(\d{2})(\d{2})\.osm\.pbf$/.exec(file);
  const date = m ? `20${m[1]}-${m[2]}-${m[3]}` : null;
  const builder = createIndexBuilder({ blocks, grid, date });
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file).pipe(parser());
    stream.on('data', (batch) => {
      try {
        for (const item of batch) builder.add(item);
      } catch (err) {
        stream.destroy(err);
      }
    });
    stream.on('error', reject);
    stream.on('end', () => {
      try {
        resolve(builder.finish());
      } catch (err) {
        reject(err);
      }
    });
  });
}
