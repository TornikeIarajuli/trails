// The local stand-in for the terrain Overpass query: same features, same JSON shape, only near the routes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, wantedKinds } from './lib/osm-extract.mjs';
import { classifyElements } from './lib/terrain.mjs';

// Two 0.2° blocks around Kazbegi (42.6–42.8 N, 44.6–44.8 E); cells are 0.02°
const blocks = ['223,213'];
const cellOf = (lon, lat) => `${Math.floor(lon / 0.02)},${Math.floor(lat / 0.02)}`;

const items = [
  // nodes in id order, as in a .pbf
  { type: 'node', id: 1, lat: 42.65, lon: 44.61 },
  { type: 'node', id: 2, lat: 42.651, lon: 44.615 },
  { type: 'node', id: 3, lat: 42.652, lon: 44.62 },
  { type: 'node', id: 4, lat: 42.66, lon: 44.63, tags: { natural: 'spring' } },
  { type: 'node', id: 5, lat: 42.661, lon: 44.631, tags: { ford: 'yes' } },
  { type: 'node', id: 6, lat: 42.662, lon: 44.632, tags: { amenity: 'shelter', shelter_type: 'public_transport' } },
  { type: 'node', id: 7, lat: 42.67, lon: 44.64 },
  { type: 'node', id: 8, lat: 42.671, lon: 44.6405 },
  { type: 'node', id: 9, lat: 42.6705, lon: 44.6412 },
  // far away (Batumi): not kept
  { type: 'node', id: 10, lat: 41.65, lon: 41.63, tags: { natural: 'spring' } },
  { type: 'node', id: 11, lat: 42.653, lon: 44.625 },
  { type: 'way', id: 100, tags: { highway: 'path', sac_scale: 'mountain_hiking' }, refs: [1, 2, 3] },
  { type: 'way', id: 101, tags: { highway: 'primary' }, refs: [1, 2] },
  { type: 'way', id: 102, tags: { tourism: 'alpine_hut', name: 'Hut' }, refs: [7, 8, 9, 7] },
  // a path that leaves the kept area (node 10) and comes back: split, never bridged across
  { type: 'way', id: 103, tags: { highway: 'track' }, refs: [3, 11, 10, 2, 1] },
];

test('wantedKinds selects what the Overpass query selects', () => {
  assert.deepEqual(wantedKinds({ highway: 'path' }), { highway: true, ford: false, point: false });
  assert.equal(wantedKinds({ highway: 'primary' }), null);
  assert.deepEqual(wantedKinds({ ford: 'yes' }), { highway: false, ford: true, point: false });
  assert.equal(wantedKinds({ ford: 'no' }), null);
  assert.deepEqual(wantedKinds({ amenity: 'drinking_water' }), { highway: false, ford: false, point: true });
  assert.equal(wantedKinds({ building: 'yes' }), null);
});

test('answers a cell with its paths, water, fords and shelters in Overpass form', () => {
  const index = buildIndex(items, { blocks, date: '2026-11-13' });
  const cells = new Set([cellOf(44.61, 42.65), cellOf(44.63, 42.66), cellOf(44.64, 42.67)]);
  const res = index.answer(cells);
  assert.equal(res.osm3s.timestamp_osm_base, '2026-11-13T00:00:00Z');

  const osm = classifyElements(res.elements);
  // the split track's other piece lies in a cell not asked for
  assert.deepEqual(osm.ways.map((w) => w.id).sort(), [100, '103~1'].sort());
  const path = osm.ways.find((w) => w.id === 100);
  assert.deepEqual(path.coords, [[44.61, 42.65], [44.615, 42.651], [44.62, 42.652]]);
  assert.equal(path.tags.sac_scale, 'mountain_hiking');
  assert.deepEqual(osm.waters.map((w) => w.id), [4]);
  assert.deepEqual(osm.fords.map((f) => f.id), [5]);
  // the alpine hut (a way) comes with its centre; the bus shelter is left out by classifyElements
  assert.deepEqual(osm.shelters.map((s) => s.id), [102]);
  assert.ok(Math.abs(osm.shelters[0].coord[1] - 42.6705) < 0.001);
});

test('a way that leaves the kept area is split there, never joined across the gap', () => {
  const index = buildIndex(items, { blocks });
  const res = index.answer(new Set([cellOf(44.62, 42.652), cellOf(44.61, 42.65)]));
  const pieces = res.elements.filter((e) => String(e.id).startsWith('103'));
  assert.deepEqual(pieces.map((p) => p.geometry.length), [2, 2]);
  assert.ok(pieces.every((p) => p.geometry.every((g) => g.lat > 42)));
});

test('leaves out what is far from the routes, and cells with nothing', () => {
  const index = buildIndex(items, { blocks });
  assert.equal(index.counts.nodes, 10); // all but the Batumi spring
  assert.deepEqual(index.answer(new Set([cellOf(44.79, 42.79)])).elements, []);
});

test('refuses an extract whose nodes are not in id order', () => {
  assert.throws(
    () => buildIndex([{ type: 'node', id: 2, lat: 42.65, lon: 44.61 }, { type: 'node', id: 1, lat: 42.65, lon: 44.61 }], { blocks }),
    /id order/,
  );
});
