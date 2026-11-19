// node --test scripts/content/  — which OSM features become places, their names, score, duplicates and region.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  KINDS, centroid, chunk, classify, compareForOutput, dedupe, elevationKey, elevationUrl, georgianOf, inTerritory,
  isGenericName, keptTags, nearestRegion, notability, parseEle, placeNames, placeProblems, placeRecord, placeRow,
  romanizeRu, trailStarts, wikiRefs,
} from './lib/places.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

test('every kind from its tags', () => {
  const cases = [
    [{ natural: 'peak' }, 'peak'],
    [{ natural: 'volcano' }, 'peak'],
    [{ mountain_pass: 'yes' }, 'pass'],
    [{ natural: 'saddle' }, 'pass'],
    [{ natural: 'water', water: 'lake' }, 'lake'],
    [{ natural: 'water', water: 'reservoir' }, 'lake'],
    [{ waterway: 'waterfall' }, 'waterfall'],
    [{ tourism: 'viewpoint' }, 'viewpoint'],
    [{ tourism: 'camp_site' }, 'campsite'],
    [{ tourism: 'alpine_hut' }, 'hut'],
    [{ tourism: 'wilderness_hut' }, 'hut'],
    [{ amenity: 'shelter', shelter_type: 'basic_hut' }, 'hut'],
    [{ amenity: 'shelter', shelter_type: 'lean_to' }, 'hut'],
    [{ natural: 'cave_entrance' }, 'cave'],
    [{ natural: 'gorge' }, 'canyon'],
    [{ natural: 'canyon' }, 'canyon'],
    [{ natural: 'glacier' }, 'glacier'],
    [{ historic: 'castle' }, 'castle'],
    [{ historic: 'fort' }, 'castle'],
    [{ historic: 'fortress' }, 'castle'],
    [{ historic: 'tower' }, 'tower'],
    [{ man_made: 'tower', 'tower:type': 'defensive' }, 'tower'],
    [{ historic: 'monastery' }, 'monastery'],
    [{ amenity: 'monastery' }, 'monastery'],
    [{ natural: 'hot_spring' }, 'hot_spring'],
    [{ amenity: 'public_bath', 'bath:type': 'hot_spring' }, 'hot_spring'],
    [{ leisure: 'fishing' }, 'fishing'],
  ];
  for (const [tags, kind] of cases) assert.equal(classify(tags), kind, JSON.stringify(tags));
  assert.deepEqual([...new Set(cases.map((c) => c[1]))].sort(), [...KINDS].sort());
});

test('what is not a place', () => {
  assert.equal(classify(undefined), null);
  assert.equal(classify({}), null);
  assert.equal(classify({ natural: 'water', water: 'river', name: 'Mtkvari' }), null);
  assert.equal(classify({ natural: 'water', water: 'pond', name: 'Lake X' }), null);
  assert.equal(classify({ natural: 'water', name: 'მოცეკვავე შადრევანი' }), null); // a fountain
  assert.equal(classify({ amenity: 'shelter', shelter_type: 'public_transport' }), null);
  assert.equal(classify({ man_made: 'tower', 'tower:type': 'communication' }), null);
  assert.equal(classify({ historic: 'ruins', ruins: 'church' }), null);
  assert.equal(classify({ amenity: 'place_of_worship', name: 'წმინდა გიორგის ეკლესია' }), null);
  // a road tagged with the pass it crosses
  assert.equal(classify({ highway: 'track', mountain_pass: 'yes', name: 'ხაიში — საკენი — ომარიშარა' }), null);
  // named after a canyon, but a hotel, a visitor centre, a ticket shop, a footpath
  assert.equal(classify({ tourism: 'hotel', name: 'Hotel Canyon' }), null);
  assert.equal(classify({ tourism: 'information', name: 'ოკაცეს კანიონი' }), null);
  assert.equal(classify({ shop: 'ticket', name: 'Okatse Canyon' }), null);
  assert.equal(classify({ highway: 'footway', name: 'Eagle canyon walk' }), null);
});

test('rules that look at more than one tag, or at the name', () => {
  assert.equal(classify({ natural: 'peak', tourism: 'viewpoint' }), 'peak');
  assert.equal(classify({ historic: 'castle', tourism: 'viewpoint' }), 'castle');
  assert.equal(classify({ natural: 'saddle', mountain_pass: 'yes' }), 'pass');
  assert.equal(classify({ historic: 'ruins', ruins: 'castle' }), 'castle');
  assert.equal(classify({ historic: 'ruins', ruins: 'fort' }), 'castle');
  assert.equal(classify({ historic: 'ruins', ruins: 'tower' }), 'tower');
  assert.equal(classify({ amenity: 'place_of_worship', name: 'ზედაზნის მონასტერი' }), 'monastery');
  assert.equal(classify({ amenity: 'place_of_worship', name: 'ამხის მონასტრის ნანგრევები' }), 'monastery');
  assert.equal(classify({ amenity: 'place_of_worship', name: 'გუდარეხი', 'name:en': 'Gudarekhi Monastery' }), 'monastery');
  // natural=water without water=*: a lake when its name says so
  assert.equal(classify({ natural: 'water', name: 'წალკის წყალსაცავი' }), 'lake');
  assert.equal(classify({ natural: 'water', name: 'Bareti Lake' }), 'lake');
  // a canyon by its name, when tagged as nature or a sight
  assert.equal(classify({ tourism: 'attraction', name: 'ოკაცეს კანიონი' }), 'canyon');
  assert.equal(classify({ tourism: 'attraction', name: 'დათვისხევი', 'name:en': 'Bear Canyon' }), 'canyon');
  assert.equal(
    classify({ boundary: 'protected_area', leisure: 'nature_reserve', name: 'მარტვილის კანიონის ბუნების ძეგლი' }),
    'canyon',
  );
  // a viewpoint or campsite named after a canyon stays what it is
  assert.equal(classify({ tourism: 'viewpoint', name: 'Okatse Canyon platform' }), 'viewpoint');
  assert.equal(classify({ tourism: 'camp_site', name: 'Camping Eagle Canyon' }), 'campsite');
});

test('names: name:en, int_name, then the Georgian name romanised, each word capitalised', () => {
  assert.deepEqual(placeNames({ name: 'უშბა', 'name:en': 'Ushba' }, 'peak'), { name_en: 'Ushba', name_ka: 'უშბა' });
  assert.deepEqual(placeNames({ name: 'უშბა', int_name: 'Ushba' }, 'peak'), { name_en: 'Ushba', name_ka: 'უშბა' });
  assert.deepEqual(placeNames({ name: 'ქოჩების ტბა' }, 'lake'), { name_en: 'Kochebis Tba', name_ka: 'ქოჩების ტბა' });
  assert.deepEqual(placeNames({ name: 'ჟინვალის წყალსაცავი' }, 'lake'), {
    name_en: 'Zhinvalis Tsqalsatsavi',
    name_ka: 'ჟინვალის წყალსაცავი',
  });
  assert.equal(placeNames({ name: 'შხარა' }, 'peak').name_en, 'Shkhara');
  assert.equal(placeNames({ name: 'დიკლოს-მთა' }, 'peak').name_en, 'Diklos-Mta');
  // name_ka: the Georgian name, else name:ka
  assert.deepEqual(placeNames({ name: 'Ushba', 'name:ka': 'უშბა' }, 'peak'), { name_en: 'Ushba', name_ka: 'უშბა' });
  assert.deepEqual(placeNames({ name: 'Ushba' }, 'peak'), { name_en: 'Ushba', name_ka: null });
  assert.deepEqual(placeNames({ 'name:ka': 'უშბა' }, 'peak'), { name_en: 'Ushba', name_ka: 'უშბა' });
});

test('names written in two scripts keep their Georgian part; Russian names are romanised', () => {
  assert.deepEqual(placeNames({ name: 'ჩუნგურბაში - Чунгурбаши' }, 'peak'), { name_en: 'Chungurbashi', name_ka: 'ჩუნგურბაში' });
  assert.deepEqual(placeNames({ name: 'Диклос-Мта / დიკლოსმთა' }, 'peak'), { name_en: 'Diklosmta', name_ka: 'დიკლოსმთა' });
  assert.deepEqual(placeNames({ name: 'ჭიდილა (Chidila)' }, 'pass'), { name_en: 'Chidila', name_ka: 'ჭიდილა' });
  assert.equal(georgianOf('ჯუმათის მონასტერი (Jumati Monastery)'), 'ჯუმათის მონასტერი');
  assert.equal(georgianOf('ამარათის თავშესაფარი (ძველი)'), 'ამარათის თავშესაფარი (ძველი)');
  assert.equal(georgianOf('ტბა - 2'), 'ტბა - 2');
  assert.equal(georgianOf('Ushba'), null);

  assert.deepEqual(placeNames({ name: 'Восточный Аксаут' }, 'peak'), { name_en: 'Vostochnyy Aksaut', name_ka: null });
  assert.deepEqual(placeNames({ name: 'Нислия / Nislia' }, 'peak'), { name_en: 'Nislia', name_ka: null });
  assert.equal(romanizeRu('пик Германского Комсомола'), 'Pik Germanskogo Komsomola');
  assert.equal(romanizeRu('Щучье'), 'Shchuche');
});

test('a name that only says what the thing is counts as no name; campsites and fishing spots need none', () => {
  assert.equal(placeNames({ name: 'ტბა' }, 'lake'), null);
  assert.equal(placeNames({ name: 'Waterfall' }, 'waterfall'), null);
  assert.equal(placeNames({ name: 'მამათა მონასტერი' }, 'monastery'), null);
  assert.equal(placeNames({}, 'peak'), null);
  assert.deepEqual(placeNames({}, 'campsite'), { name_en: 'Campsite', name_ka: null });
  assert.deepEqual(placeNames({ name: 'Camping' }, 'campsite'), { name_en: 'Campsite', name_ka: null });
  assert.deepEqual(placeNames({ name: 'მთა' }, 'campsite'), { name_en: 'Campsite', name_ka: null });
  assert.deepEqual(placeNames({}, 'fishing'), { name_en: 'Fishing spot', name_ka: null });
  assert.deepEqual(placeNames({ name: 'Sioni Fishing' }, 'fishing'), { name_en: 'Sioni Fishing', name_ka: null });
  // a generic English name does not hide a real Georgian one
  assert.deepEqual(placeNames({ name: 'მერისის ჩანჩქერი', 'name:en': 'Waterfall' }, 'waterfall'), {
    name_en: 'Merisis Chanchkeri',
    name_ka: 'მერისის ჩანჩქერი',
  });
  assert.ok(isGenericName('Tba'));
  assert.ok(isGenericName(' Small  waterfall '));
  assert.ok(!isGenericName('Green Lake'));
});

test('elevation from a numeric ele tag', () => {
  assert.equal(parseEle('2350'), 2350);
  assert.equal(parseEle('1647.6'), 1648);
  assert.equal(parseEle(' 3014 m'), 3014);
  assert.equal(parseEle('unknown'), null);
  assert.equal(parseEle('3,000'), null);
  assert.equal(parseEle('50470'), null);
  assert.equal(parseEle(undefined), null);
});

test('notability: links, a sight, an English name, a photo, and the kind', () => {
  assert.equal(notability({ kind: 'canyon', tags: {} }), 3);
  assert.equal(notability({ kind: 'waterfall', tags: {} }), 2);
  assert.equal(notability({ kind: 'campsite', tags: {} }), 1);
  assert.equal(notability({ kind: 'peak', tags: {}, elevation_m: 2999 }), 1);
  assert.equal(notability({ kind: 'peak', tags: {}, elevation_m: 3000 }), 2);
  assert.equal(notability({ kind: 'peak', tags: {}, elevation_m: null }), 1);
  // castle 2 + wikidata 3 + wikipedia 3 + attraction 2 + name:en 1 + photo 1
  const gonio = {
    wikidata: 'Q944813', wikipedia: 'ka:გონიოს ციხე', tourism: 'attraction', 'name:en': 'Gonio Fortress',
    wikimedia_commons: 'Category:Gonio Fortress',
  };
  assert.equal(notability({ kind: 'castle', tags: gonio }), 12);
  assert.equal(notability({ kind: 'hut', tags: { image: 'https://example.org/hut.jpg' } }), 2);
  assert.equal(notability({ kind: 'cave', tags: { 'wikipedia:ru': 'Сатаплия' } }), 4);
  assert.equal(notability({ kind: 'cave', tags: { wikidata: 'not an id' } }), 1);
});

test('wiki links and the tags kept', () => {
  assert.deepEqual(wikiRefs({ wikidata: 'Q1;Q2', 'wikipedia:ru': 'Сатаплия' }), { wikidata: 'Q1', wikipedia: 'ru:Сатаплия' });
  assert.deepEqual(wikiRefs({ wikipedia: 'en:Ushba' }), { wikidata: null, wikipedia: 'en:Ushba' });
  assert.deepEqual(wikiRefs({}), { wikidata: null, wikipedia: null });
  assert.deepEqual(
    keptTags({ ele: '2155', fee: 'no', 'contact:website': 'https://apa.gov.ge', name: 'x', building: 'yes', capacity: ' 12 ' }),
    { ele: '2155', fee: 'no', capacity: '12', website: 'https://apa.gov.ge' },
  );
  assert.equal(keptTags({ website: 'x'.repeat(400) }).website.length, 300);
});

test('an area sits at the mean of its outer nodes', () => {
  assert.deepEqual(centroid([[44, 42], [46, 42], [46, 44], [44, 44]]), [45, 43]);
  assert.equal(centroid([]), null);
});

test('duplicates: same kind and name within 300 m, the most notable stays', () => {
  const place = (o) => ({ osm_type: 'node', osm_id: 1, kind: 'lake', name_en: 'Green Lake', latitude: 42, longitude: 44, notability: 2, ...o });
  // 0.001° of latitude is about 111 m
  const list = [
    place({ osm_id: 1 }),
    place({ osm_id: 2, notability: 5, latitude: 42.002 }), // 222 m away and more notable: stays
    place({ osm_id: 3, name_en: 'green lake', latitude: 42.001 }), // the same name in another case: merged
    place({ osm_id: 4, latitude: 42.01 }), // 890 m from the one kept: a place of its own
    place({ osm_id: 5, kind: 'viewpoint' }), // another kind
    place({ osm_id: 6, name_en: 'Blue Lake' }), // another name
  ];
  assert.deepEqual(dedupe(list).map((p) => p.osm_id).sort((a, b) => a - b), [2, 4, 5, 6]);
  // equally notable: the area before the point
  assert.deepEqual(dedupe([place({ osm_id: 7 }), place({ osm_type: 'way', osm_id: 9 })]).map((p) => p.osm_type), ['way']);
});

test('region: of the nearest trail start within 80 km', () => {
  const starts = trailStarts({
    trails: [
      { region: 'Kazbegi', start_point: [44.6405, 42.6607] },
      { region: 'Svaneti', start_point: [42.7277, 43.039] },
      { region: null, start_point: [44, 42] },
      { region: 'Tusheti', route: [[45.63, 42.38], [45.64, 42.39]] },
    ],
  });
  assert.equal(starts.length, 3);
  assert.equal(nearestRegion([44.5176, 42.6965], starts), 'Kazbegi'); // Kazbek, ~11 km from Gergeti
  assert.equal(nearestRegion([42.6648, 43.1277], starts), 'Svaneti'); // Ushba
  assert.equal(nearestRegion([45.7, 42.4], starts), 'Tusheti'); // a trail without start_point starts its route
  assert.equal(nearestRegion([41.6, 41.6], starts), null); // Batumi: no trail start within 80 km
  assert.equal(nearestRegion([44.5, 42.7], starts, 5), null);
});

test('territory: Georgian-controlled ground, with slack at the border', () => {
  const inBox = (p, [w, s, e, n]) => p[0] >= w && p[0] <= e && p[1] >= s && p[1] <= n;
  const territory = {
    inCountry: (p) => inBox(p, [40, 41, 46, 43.5]),
    inOccupied: (p) => inBox(p, [40, 42.5, 41.5, 43.5]),
  };
  const mPerDegLng = 111195 * Math.cos((42 * Math.PI) / 180);
  assert.equal(inTerritory([44, 42], territory), true);
  assert.equal(inTerritory([41, 43], territory), false); // occupied
  assert.equal(inTerritory([47, 42], territory), false); // abroad
  assert.equal(inTerritory([46 + 200 / mPerDegLng, 42], territory), true); // 200 m over the border: on the ridge
  assert.equal(inTerritory([46 + 800 / mPerDegLng, 42], territory), false);
  // just over the border, but next to the occupied territory only
  assert.equal(inTerritory([41, 43.5 + 200 / 111195], territory), false);
});

test('elevation lookups: rounded keys, up to 100 points a request', () => {
  assert.equal(elevationKey(42.123456, 44.987654), '42.1235,44.9877');
  assert.equal(
    elevationUrl(['42.1235,44.9877', '41.5000,45.2500']),
    'https://api.open-meteo.com/v1/elevation?latitude=42.1235,41.5000&longitude=44.9877,45.2500',
  );
});

test('a places.json entry, its order and its database row', () => {
  const tags = {
    natural: 'water', water: 'lake', ele: '624', wikidata: 'Q2371265', wikipedia: 'ka:ლისის ტბა', 'name:en': 'Lisi Lake',
    wikimedia_commons: 'Category:Lisi Lake',
  };
  const record = placeRecord({
    osm_type: 'way', osm_id: 20841667, kind: 'lake', names: { name_en: 'Lisi Lake', name_ka: 'ლისის ტბა' },
    point: [44.73333333333, 41.74333333333], elevation_m: 624, region: 'Tbilisi', tags,
  });
  assert.deepEqual(record, {
    osm_type: 'way', osm_id: 20841667, kind: 'lake', name_en: 'Lisi Lake', name_ka: 'ლისის ტბა',
    latitude: 41.7433333, longitude: 44.7333333, elevation_m: 624, region: 'Tbilisi', wikidata: 'Q2371265',
    wikipedia: 'ka:ლისის ტბა', tags: { ele: '624', water: 'lake', wikimedia_commons: 'Category:Lisi Lake' }, notability: 10,
  });
  assert.deepEqual(placeProblems(record), []);
  assert.deepEqual(placeProblems({ ...record, kind: 'volcano', osm_id: -1, name_en: ' ', latitude: NaN }), [
    'osm_id -1', 'kind volcano', 'no name_en', 'latitude NaN',
  ]);

  const order = [
    { kind: 'lake', notability: 2, name_en: 'B', osm_type: 'node', osm_id: 1 },
    { kind: 'peak', notability: 1, name_en: 'Z', osm_type: 'node', osm_id: 2 },
    { kind: 'lake', notability: 5, name_en: 'C', osm_type: 'node', osm_id: 3 },
    { kind: 'lake', notability: 2, name_en: 'A', osm_type: 'node', osm_id: 4 },
  ];
  assert.deepEqual(order.sort(compareForOutput).map((p) => p.osm_id), [2, 3, 4, 1]);

  const row = placeRow({ ...record, name_ka: undefined, tags: undefined }, '2026-11-20T00:00:00.000Z');
  assert.deepEqual(Object.keys(row), [
    'osm_type', 'osm_id', 'kind', 'name_en', 'name_ka', 'latitude', 'longitude', 'elevation_m', 'region', 'wikidata',
    'wikipedia', 'tags', 'notability', 'updated_at',
  ]);
  assert.equal(row.name_ka, null);
  assert.deepEqual(row.tags, {});
  assert.equal(row.updated_at, '2026-11-20T00:00:00.000Z');
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test('the kinds are those of the check constraint in migration 068', () => {
  const sql = fs.readFileSync(path.join(here, '..', '..', 'supabase', 'migrations', '068_places.sql'), 'utf8');
  const list = /kind in \(([^)]*)\)/.exec(sql)[1].match(/'[a-z_]+'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(list, KINDS);
});
