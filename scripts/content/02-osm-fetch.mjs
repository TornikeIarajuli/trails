// Step 2 — everything the pipeline needs from OpenStreetMap, in a handful of cached Overpass requests:
//   hiking/foot route relations in Georgia (with member geometry), named features used as
//   checkpoints, administrative boundaries (regions, municipalities, occupied territories), parks.
// Output: content/work/osm-relations.json, osm-pois.json, osm-admin.json
//
//   node scripts/content/02-osm-fetch.mjs [--refresh]
import path from 'node:path';
import { overpass, relationWays } from './lib/overpass.mjs';
import { assembleRings, simplifyDP } from './lib/geo.mjs';
import { DATA, WORK, readJson, writeJson } from './lib/paths.mjs';

const refresh = process.argv.includes('--refresh');
const GE = 'area["ISO3166-1"="GE"][admin_level=2]->.ge;';
const q = (body, timeout = 600) => `[out:json][timeout:${timeout}];${body}`;

// ---------- route relations ----------
const discovery = await overpass(
  q(`${GE}relation["type"~"^(route|superroute)$"]["route"~"^(hiking|foot)$"](area.ge);out tags bb;`, 300),
  { refresh, label: 'discover' },
);
const relationMap = readJson(path.join(DATA, 'relation-map.json'));
const knownIds = new Set(Object.values(relationMap).flatMap((m) => m.relations));
const ids = [...new Set([...discovery.elements.map((e) => e.id), ...knownIds])].sort((a, b) => a - b);
console.log(`route relations: ${discovery.elements.length} discovered + ${[...knownIds].filter((id) => !discovery.elements.some((e) => e.id === id)).length} known-only = ${ids.length}`);

const relations = {};
const BATCH = 20;
for (let i = 0; i < ids.length; i += BATCH) {
  const batch = ids.slice(i, i + BATCH);
  const res = await overpass(q(`relation(id:${batch.join(',')});out geom;`), { refresh, label: `relations ${i}-${i + batch.length}` });
  for (const el of res.elements) {
    if (el.type !== 'relation') continue;
    relations[el.id] = {
      id: el.id,
      tags: el.tags ?? {},
      in_discovery: discovery.elements.some((e) => e.id === el.id),
      member_count: (el.members ?? []).length,
      subrelations: (el.members ?? []).filter((m) => m.type === 'relation').map((m) => m.ref),
      nodes: (el.members ?? []).filter((m) => m.type === 'node' && m.lat != null).map((m) => ({ role: m.role ?? '', coord: [m.lon, m.lat] })),
      ways: relationWays(el),
    };
  }
  console.log(`  relations ${Math.min(i + BATCH, ids.length)}/${ids.length}`);
}
const missing = ids.filter((id) => !relations[id]);
if (missing.length) console.log(`  not in OSM any more: ${missing.join(', ')}`);
writeJson(path.join(WORK, 'osm-relations.json'), { fetched_at: new Date().toISOString(), missing, relations });

// ---------- administrative areas ----------
function ringsOf(el) {
  if (el.type === 'way') return assembleRings([el.geometry.map((g) => [g.lon, g.lat])]);
  const outers = (el.members ?? [])
    .filter((m) => m.type === 'way' && m.geometry && m.role !== 'inner')
    .map((m) => m.geometry.filter(Boolean).map((g) => [g.lon, g.lat]));
  const inners = (el.members ?? [])
    .filter((m) => m.type === 'way' && m.geometry && m.role === 'inner')
    .map((m) => m.geometry.filter(Boolean).map((g) => [g.lon, g.lat]));
  // even-odd point-in-polygon treats inner rings as holes, so they can live in the same list
  return [...assembleRings(outers), ...assembleRings(inners)].map((r) => (r.length > 800 ? simplifyDP(r, 15) : r));
}
const areaOf = (el) => ({
  osm: `${el.type}/${el.id}`,
  name: el.tags?.name ?? null,
  name_en: el.tags?.['name:en'] ?? el.tags?.int_name ?? null,
  name_ka: el.tags?.['name:ka'] ?? (/[Ⴀ-ჿ]/.test(el.tags?.name ?? '') ? el.tags.name : null),
  admin_level: el.tags?.admin_level ?? null,
  iso: el.tags?.['ISO3166-2'] ?? null,
  rings: ringsOf(el),
});

const special = await overpass(q('relation(id:28699,1152717,1152720);out geom;'), { refresh, label: 'country+occupied' });
const byId = Object.fromEntries(special.elements.map((e) => [e.id, e]));
const adminRes = await overpass(
  q(`${GE}relation["boundary"="administrative"]["admin_level"~"^(4|6)$"](area.ge);out geom;`),
  { refresh, label: 'admin 4+6' },
);
const parksRes = await overpass(
  q(`${GE}(relation["boundary"~"^(national_park|protected_area)$"]["name"](area.ge);way["boundary"~"^(national_park|protected_area)$"]["name"](area.ge););out geom;`),
  { refresh, label: 'parks' },
);
const admin = {
  fetched_at: new Date().toISOString(),
  country: areaOf(byId[28699]),
  occupied: [areaOf(byId[1152717]), areaOf(byId[1152720])],
  regions: adminRes.elements.filter((e) => e.tags.admin_level === '4').map(areaOf),
  municipalities: adminRes.elements.filter((e) => e.tags.admin_level === '6').map(areaOf),
  parks: parksRes.elements
    .map((el) => ({ ...areaOf(el), boundary: el.tags.boundary, protect_class: el.tags.protect_class ?? null, title: el.tags.protection_title ?? null }))
    .filter((p) => p.rings.length),
};
writeJson(path.join(WORK, 'osm-admin.json'), admin);
console.log(`admin: ${admin.regions.length} regions, ${admin.municipalities.length} municipalities, ${admin.parks.length} parks`);

// ---------- named features (checkpoint candidates, place names) ----------
const poiQueries = {
  nature: `(
    node["natural"~"^(peak|volcano|saddle)$"]["name"](area.ge);
    node["mountain_pass"="yes"]["name"](area.ge);
    nwr["tourism"="viewpoint"](area.ge);
    nwr["waterway"="waterfall"](area.ge);
    node["natural"~"^(spring|cave_entrance)$"](area.ge);
    nwr["amenity"="drinking_water"](area.ge);
    nwr["tourism"~"^(alpine_hut|wilderness_hut|camp_site)$"](area.ge);
    nwr["amenity"="shelter"]["shelter_type"!="public_transport"](area.ge);
  );out center tags;`,
  places: `node["place"~"^(city|town|village|hamlet|isolated_dwelling|locality|suburb|neighbourhood)$"]["name"](area.ge);out center tags;`,
  culture: `(
    nwr["amenity"~"^(place_of_worship|monastery)$"]["name"](area.ge);
    nwr["historic"~"^(castle|fort|fortress|ruins|tower|church|monastery|archaeological_site|city_gate|monument|memorial|wayside_cross|wayside_shrine)$"]["name"](area.ge);
    nwr["man_made"~"^(tower|bridge|cross)$"]["name"](area.ge);
    nwr["building"~"^(church|chapel|monastery|tower|cathedral)$"]["name"](area.ge);
    nwr["tourism"~"^(attraction|information)$"]["name"](area.ge);
  );out center tags;`,
  water: `(
    nwr["natural"="water"]["name"]["water"!~"^(river|stream|canal|ditch|drain|oxbow)$"](area.ge);
    nwr["natural"="glacier"]["name"](area.ge);
  );out geom;`,
};

function classify(tags) {
  const t = tags;
  if (t.natural === 'peak' || t.natural === 'volcano') return 'peak';
  if (t.natural === 'saddle' || t.mountain_pass === 'yes') return 'pass';
  if (t.waterway === 'waterfall') return 'waterfall';
  if (t.natural === 'water') return 'lake';
  if (t.natural === 'glacier') return 'glacier';
  if (t.natural === 'spring' || t.amenity === 'drinking_water') return 'water';
  if (t.tourism === 'alpine_hut' || t.tourism === 'wilderness_hut' || t.amenity === 'shelter') return 'hut';
  if (t.tourism === 'camp_site') return 'camp';
  if (t.tourism === 'viewpoint') return 'viewpoint';
  if (t.natural === 'cave_entrance') return 'cave';
  if (t.place) return 'place';
  if (/^(castle|fort|fortress|ruins|archaeological_site|city_gate)$/.test(t.historic ?? '') || t.ruins === 'yes') {
    return t.historic === 'ruins' && /church|monastery|chapel/.test(`${t.ruins ?? ''} ${t.building ?? ''} ${t.amenity ?? ''}`) ? 'church' : 'ruins';
  }
  if (t.historic === 'tower' || t.man_made === 'tower' || t.building === 'tower') return 'tower';
  if (t.amenity === 'place_of_worship' || t.amenity === 'monastery' || /^(church|monastery)$/.test(t.historic ?? '') || /^(church|chapel|monastery|cathedral)$/.test(t.building ?? '')) return 'church';
  if (t.man_made === 'bridge') return 'bridge';
  if (t.tourism === 'information') return 'info';
  return 'landmark';
}

const KEEP_TAGS = ['ele', 'place', 'natural', 'tourism', 'amenity', 'historic', 'man_made', 'building', 'waterway', 'water', 'ruins', 'religion', 'tower:type', 'information', 'drinking_water', 'shelter_type', 'wikidata', 'population', 'alt_name', 'old_name', 'name:ru', 'int_name', 'name:ka-Latn', 'official_name'];

const pois = [];
const seen = new Set();
for (const [label, body] of Object.entries(poiQueries)) {
  const res = await overpass(q(GE + body), { refresh, label: `pois ${label}` });
  for (const el of res.elements) {
    const key = `${el.type}/${el.id}`;
    if (seen.has(key) || !el.tags) continue;
    seen.add(key);
    const kind = classify(el.tags);
    let coord = el.type === 'node' ? [el.lon, el.lat] : el.center ? [el.center.lon, el.center.lat] : null;
    let outline = null;
    if (label === 'water') {
      const rings = el.type === 'node' ? [] : ringsOf(el);
      if (rings.length) {
        outline = rings.map((r) => (r.length > 60 ? simplifyDP(r, 8) : r));
        if (!coord) {
          const all = outline.flat();
          coord = [all.reduce((s, c) => s + c[0], 0) / all.length, all.reduce((s, c) => s + c[1], 0) / all.length];
        }
      } else if (el.type === 'way' && el.geometry) {
        const line = el.geometry.map((g) => [g.lon, g.lat]);
        outline = [line];
        coord ??= line[Math.floor(line.length / 2)];
      }
    }
    if (!coord || typeof coord[0] !== 'number' || typeof coord[1] !== 'number') continue;
    const tags = {};
    for (const k of KEEP_TAGS) if (el.tags[k] != null) tags[k] = el.tags[k];
    pois.push({
      osm: key,
      kind,
      name: el.tags.name ?? null,
      name_en: el.tags['name:en'] ?? null,
      name_ka: el.tags['name:ka'] ?? null,
      coord,
      ...(outline ? { outline } : {}),
      tags,
    });
  }
  console.log(`  pois ${label}: ${res.elements.length} elements`);
}
writeJson(path.join(WORK, 'osm-pois.json'), { fetched_at: new Date().toISOString(), pois });
const kinds = {};
for (const p of pois) kinds[p.kind] = (kinds[p.kind] ?? 0) + 1;
console.log('pois by kind:', kinds);
