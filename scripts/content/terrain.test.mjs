// node --test scripts/content/  — terrain matching on synthetic geometries.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  blockOf, cellsNear, cellsQuery, classifyElements, clusterCount, computeTerrain, describeTerrain, pieces, sacGrade,
  stableStringify, surfaceBucket, terrainProblems,
} from './lib/terrain.mjs';

// metres east / north of a point in Tbilisi → [lon, lat]
const LAT0 = 41.7;
const LON0 = 44.8;
const M_PER_DEG = (6371000 * Math.PI) / 180; // the sphere haversineM uses
const at = (east, north) => [LON0 + east / (M_PER_DEG * Math.cos((LAT0 * Math.PI) / 180)), LAT0 + north / M_PER_DEG];
const node = (id, [lon, lat], tags) => ({ type: 'node', id, lat, lon, tags });
const way = (id, coords, tags) => ({ type: 'way', id, tags, geometry: coords.map(([lon, lat]) => ({ lat, lon })) });
// a 1 km route running east
const route = [at(0, 0), at(500, 0), at(1000, 0)];

test('sac_scale and surface values map to grades and buckets', () => {
  assert.equal(sacGrade('hiking'), 'T1');
  assert.equal(sacGrade('demanding_mountain_hiking'), 'T3');
  assert.equal(sacGrade('mountain_hiking;alpine_hiking'), 'T4');
  assert.equal(sacGrade('T5'), 'T5');
  assert.equal(sacGrade('strolling'), null);
  assert.equal(sacGrade(undefined), null);
  assert.equal(surfaceBucket('asphalt'), 'paved');
  assert.equal(surfaceBucket('concrete:plates'), 'paved');
  assert.equal(surfaceBucket('compacted'), 'gravel');
  assert.equal(surfaceBucket('dirt;grass'), 'ground');
  assert.equal(surfaceBucket('meadow'), 'grass');
  assert.equal(surfaceBucket('scree'), 'rock');
  assert.equal(surfaceBucket('woodchips'), 'other');
  assert.equal(surfaceBucket(undefined), null);
});

test('pieces cover the whole line in steps of at most 20 m', () => {
  const p = pieces(route, 20);
  const total = p.reduce((n, x) => n + x.len, 0);
  assert.ok(Math.abs(total - 1000) < 1, `total ${total}`);
  assert.ok(p.every((x) => x.len <= 20.0001));
});

test('a route on a T3 rock path is fully covered and graded T3', () => {
  const osm = classifyElements([
    way(1, [at(-50, 5), at(1050, 5)], { highway: 'path', sac_scale: 'demanding_mountain_hiking', surface: 'rock' }),
  ]);
  const { terrain, details } = computeTerrain(route, osm, '2026-11-14');
  assert.deepEqual(terrain, {
    source: 'osm', fetched_at: '2026-11-14', coverage: 1, max_sac: 'T3', sac_km: { T3: 1 }, surfaces_km: { rock: 1 },
    fords: 0, water_points: 0, shelters: 0,
  });
  assert.deepEqual(terrainProblems(terrain), []);
  assert.equal(details.length_m, 1000);
});

test('a gap with no way counts nowhere; a parallel way 30 m off does not match; untagged surface goes nowhere', () => {
  const osm = classifyElements([
    way(1, [at(0, 3), at(600, 3)], { highway: 'track', sac_scale: 'hiking' }), // first 600 m, no surface tag
    way(2, [at(600, 30), at(1000, 30)], { highway: 'path', sac_scale: 'alpine_hiking', surface: 'rock' }), // 30 m away
    way(3, [at(0, 0), at(1000, 0)], { highway: 'primary', surface: 'asphalt' }), // not a hiking way
  ]);
  const { terrain, details } = computeTerrain(route, osm, '2026-11-14');
  // the piece just past the end of a way is still within 20 m of it, so a gap starts up to 20 m late
  assert.ok(terrain.coverage >= 0.6 && terrain.coverage <= 0.62, String(terrain.coverage));
  assert.deepEqual(terrain.sac_km, { T1: 0.6 });
  assert.equal(terrain.max_sac, 'T1');
  assert.deepEqual(terrain.surfaces_km, {});
  assert.ok(details.no_surface_m >= 600 && details.no_surface_m <= 620);
  assert.ok(details.matched_m <= 620);
});

test('max_sac needs at least 100 m of a grade; shorter stretches still show in sac_km', () => {
  const osm = classifyElements([
    way(1, [at(0, 0), at(940, 0)], { highway: 'path', sac_scale: 'mountain_hiking', surface: 'ground' }),
    way(2, [at(940, 0), at(1000, 0)], { highway: 'path', sac_scale: 'alpine_hiking', surface: 'rock' }),
  ]);
  const { terrain } = computeTerrain(route, osm, '2026-11-14');
  assert.equal(terrain.max_sac, 'T2');
  assert.deepEqual(terrain.sac_km, { T2: 0.9, T4: 0.1 });
  assert.deepEqual(terrain.surfaces_km, { ground: 0.9, rock: 0.1 });
  assert.deepEqual(terrainProblems(terrain), []);
  const none = computeTerrain(route, classifyElements([way(1, route, { highway: 'track' })]), '2026-11-14').terrain;
  assert.equal(none.max_sac, null);
  assert.deepEqual(none.sac_km, {});
});

test('a ford node 10 m from the route counts, one 60 m away does not; ford=no never counts', () => {
  const osm = classifyElements([
    node(10, at(300, 10), { ford: 'yes' }),
    node(11, at(700, 60), { ford: 'yes' }),
    node(12, at(800, 0), { ford: 'no' }),
  ]);
  const { terrain, details } = computeTerrain(route, osm, '2026-11-14');
  assert.equal(terrain.fords, 1);
  assert.deepEqual(details.fords.map((f) => f.id), [10]);
});

test('hits close together count once: fords within 100 m, water within 50 m, shelters within 100 m', () => {
  const osm = classifyElements([
    // one crossing mapped as a node and as a ford way, plus a second crossing 300 m on
    node(20, at(100, 5), { ford: 'yes' }),
    way(21, [at(130, -20), at(130, 20)], { highway: 'path', ford: 'yes' }),
    node(22, at(430, 0), { ford: 'stepping_stones' }),
    // two springs 30 m apart = one water point; a tap 120 m away is too far; an undrinkable spring does not count
    node(30, at(200, 80), { natural: 'spring' }),
    node(31, at(230, 80), { natural: 'spring' }),
    node(32, at(600, 120), { man_made: 'water_tap' }),
    node(33, at(900, 20), { natural: 'spring', drinking_water: 'no' }),
    // a hut 150 m away, a bus shelter on the route (not counted), a shelter way (centre) 100 m away
    node(40, at(500, 150), { tourism: 'alpine_hut', name: 'Hut' }),
    node(41, at(50, 0), { amenity: 'shelter', shelter_type: 'public_transport' }),
    { type: 'way', id: 42, tags: { amenity: 'shelter' }, center: (([lon, lat]) => ({ lon, lat }))(at(900, -100)) },
  ]);
  assert.equal(osm.waters.length, 3);
  assert.equal(osm.shelters.length, 2);
  const { terrain } = computeTerrain(route, osm, '2026-11-14');
  assert.equal(terrain.fords, 2);
  assert.equal(terrain.water_points, 1);
  assert.equal(terrain.shelters, 2);
  assert.equal(clusterCount([at(0, 0), at(60, 0), at(120, 0)], 100), 1); // chained
  assert.equal(clusterCount([at(0, 0), at(300, 0)], 100), 2);
  assert.equal(clusterCount([], 100), 0);
});

test('Overpass elements are de-duplicated and classified', () => {
  const w = way(5, route, { highway: 'path', ford: 'yes' });
  const osm = classifyElements([w, { ...w, tags: { highway: 'path', ford: 'yes' } }, way(6, route, { highway: 'motorway' })]);
  assert.deepEqual(osm.ways.map((x) => x.id), [5]);
  assert.deepEqual(osm.fords.map((x) => x.id), [5]);
});

test('the terrain contract is checked, compared without regard to key order and shown in one line', () => {
  const t = { source: 'osm', fetched_at: '2026-11-14', coverage: 0.86, max_sac: 'T3', sac_km: { T1: 3.2, T3: 1.1 }, surfaces_km: { ground: 5 }, fords: 2, water_points: 1, shelters: 0 };
  assert.deepEqual(terrainProblems(t), []);
  assert.equal(stableStringify(t), stableStringify(Object.fromEntries(Object.entries(t).reverse())));
  assert.equal(describeTerrain(t), 'T3, 2 fords, 1 water point, 0 shelters, 86 % on OSM ways');
  assert.match(terrainProblems({ ...t, fords: -1 }).join(' | '), /fords/);
  assert.match(terrainProblems({ ...t, max_sac: 'T7' }).join(' | '), /max_sac/);
  assert.match(terrainProblems({ ...t, sac_km: { T2: 0 } }).join(' | '), /sac_km/);
  assert.match(terrainProblems({ ...t, coverage: 1.5 }).join(' | '), /coverage/);
  const { shelters, ...missing } = t;
  assert.match(terrainProblems(missing).join(' | '), /missing shelters/);
  assert.deepEqual(terrainProblems({ ...t, coverage: 0.29 }), []);
});

test('routes are fetched as grid cells within 250 m, merged into one box per row run', () => {
  // a 1 km line well inside one 0.02° cell (~1.7 × 2.2 km), and the same line at a cell edge
  const inside = cellsNear([[44.805, 41.705], [44.815, 41.705]]);
  assert.deepEqual([...inside], ['2240,2085']);
  const edge = cellsNear([[44.7995, 41.705], [44.8095, 41.705]]);
  assert.deepEqual([...edge].sort(), ['2239,2085', '2240,2085']);
  assert.equal(blockOf('2240,2085'), '224,208');
  assert.equal(blockOf('2239,2085'), '223,208');
  const q = cellsQuery(new Set(['2239,2085', '2240,2085', '2242,2085', '2240,2086']));
  const boxes = [...new Set(q.match(/\((?:-?[\d.]+,){3}-?[\d.]+\)/g))];
  assert.deepEqual(boxes, ['(41.7,44.78,41.72,44.82)', '(41.7,44.84,41.72,44.86)', '(41.72,44.8,41.74,44.82)']);
  assert.match(q, /way\(41\.7,44\.78,41\.72,44\.82\)\[highway~"\^\(path\|footway\|track/);
  assert.match(q, /node\(41\.7,44\.78,41\.72,44\.82\)\[ford\]\[ford!=no\]/);
  assert.match(q, /nwr\(41\.7,44\.78,41\.72,44\.82\)\[natural=spring\]/);
  assert.ok(!/ \(/.test(q.replace(/^\(|\n\(/g, '')), 'no space before a box');
});
