// Named outdoor places from OpenStreetMap (step 13): which features count, their names, score and duplicates.
import { haversineM } from './geo.mjs';
import { hasCyrillic, hasGeorgian, isLatin, romanizeKa } from './names.mjs';

/** The kinds of place, in output order (and the check constraint of migration 068). */
export const KINDS = [
  'peak', 'pass', 'lake', 'waterfall', 'viewpoint', 'campsite', 'hut', 'cave', 'canyon', 'glacier', 'castle', 'tower',
  'monastery', 'hot_spring', 'fishing',
];

/** Kinds kept without a name, and the name they get. */
export const UNNAMED = { campsite: 'Campsite', fishing: 'Fishing spot' };

export const KIND_WEIGHT = {
  canyon: 3,
  waterfall: 2, lake: 2, viewpoint: 2, castle: 2, tower: 2, monastery: 2, glacier: 2, hot_spring: 2,
  peak: 1, pass: 1, hut: 1, campsite: 1, cave: 1, fishing: 1,
};

/** OSM tags carried into places.tags (website also from contact:website). */
export const KEPT_TAGS = [
  'ele', 'fee', 'drinking_water', 'capacity', 'website', 'opening_hours', 'access', 'operator', 'water', 'shelter_type',
  'ruins', 'wikimedia_commons', 'image',
];

export const DEDUPE_RADIUS_M = 300;
export const REGION_RADIUS_KM = 80;
/** A feature this close to Georgian-controlled ground still counts (summits and passes on the border ridge). */
export const BORDER_TOLERANCE_M = 300;

const CANYON_NAME = /canyon|კანიონი/i;
const MONASTERY_NAME = /monastery|მონასტერ|მონასტრ/i;
// natural=water without water=* is how many big lakes and reservoirs are tagged (Tsalka, Shaori, Jandari)
const LAKE_NAME = /lake|reservoir|ტბა|წყალსაცავ|озеро|водохранилище/i;

const names = (tags) => [tags.name, tags['name:en'], tags['name:ka'], tags.int_name].filter(Boolean).join(' ');
const oneOf = (value, list) => value !== undefined && list.includes(value);

/** A feature named "… Canyon" is the canyon itself only when it is tagged as nature or a sight, not a hotel or a bus stop. */
function canyonLike(tags) {
  return (
    tags.tourism === 'attraction' ||
    oneOf(tags.natural, ['valley', 'cliff', 'rock', 'bare_rock', 'ridge']) ||
    oneOf(tags.boundary, ['protected_area', 'national_park']) ||
    oneOf(tags.leisure, ['nature_reserve', 'park']) ||
    tags.place === 'locality'
  );
}

/**
 * The kind of place an OSM feature is, from its tags, or null. The first rule that matches wins, so a peak with a
 * viewpoint tag is a peak and a castle's viewpoint tag does not make it a viewpoint. Whether it needs a name is
 * placeNames' business.
 */
export function classify(tags) {
  if (!tags) return null;
  const { natural, tourism, amenity, historic } = tags;
  if (natural === 'hot_spring' || (amenity === 'public_bath' && tags['bath:type'] === 'hot_spring')) return 'hot_spring';
  if (natural === 'glacier') return 'glacier';
  if (natural === 'water' && (oneOf(tags.water, ['lake', 'reservoir']) || (!tags.water && LAKE_NAME.test(names(tags))))) {
    return 'lake';
  }
  if (tags.waterway === 'waterfall') return 'waterfall';
  if (natural === 'cave_entrance') return 'cave';
  if (natural === 'gorge' || natural === 'canyon') return 'canyon';
  if (natural === 'peak' || natural === 'volcano') return 'peak';
  // a road tagged as the pass it crosses is the road (one "pass" per segment, named after the road)
  if ((tags.mountain_pass === 'yes' && !tags.highway) || natural === 'saddle') return 'pass';
  if (oneOf(historic, ['castle', 'fort', 'fortress']) || (historic === 'ruins' && oneOf(tags.ruins, ['castle', 'fort', 'fortress']))) {
    return 'castle';
  }
  if (historic === 'tower' || (tags.man_made === 'tower' && tags['tower:type'] === 'defensive') || (historic === 'ruins' && tags.ruins === 'tower')) {
    return 'tower';
  }
  if (historic === 'monastery' || amenity === 'monastery' || (amenity === 'place_of_worship' && MONASTERY_NAME.test(names(tags)))) {
    return 'monastery';
  }
  if (oneOf(tourism, ['alpine_hut', 'wilderness_hut']) || (amenity === 'shelter' && oneOf(tags.shelter_type, ['basic_hut', 'lean_to']))) {
    return 'hut';
  }
  if (tourism === 'camp_site') return 'campsite';
  if (tourism === 'viewpoint') return 'viewpoint';
  if (tags.leisure === 'fishing') return 'fishing';
  if (CANYON_NAME.test(names(tags)) && canyonLike(tags)) return 'canyon';
  return null;
}

const RU_LATIN = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** Russian Cyrillic → Latin (simplified BGN/PCGN), each word capitalised: border-ridge features often have no other name. */
export function romanizeRu(s) {
  const latin = [...s]
    .map((ch) => {
      const lower = ch.toLowerCase();
      const out = RU_LATIN[lower];
      if (out === undefined) return ch;
      return ch === lower ? out : out.charAt(0).toUpperCase() + out.slice(1);
    })
    .join('');
  return latin.replace(/(^|[\s\-–(/])([a-z])/g, (_, pre, c) => pre + c.toUpperCase());
}

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '') || null;

/** Georgian, then any Russian left in it, romanised. */
const romanize = (s) => {
  const latin = romanizeKa(s);
  return hasCyrillic(latin) ? romanizeRu(latin) : latin;
};

/** The parts of a name written in several scripts: "ჩუნგურბაში - Чунгурбаши", "Нислия / Nislia", "ჭიდილა (Chidila)". */
const nameParts = (name) => name.split(/\s+[-–—]\s+|\s*[/;()]\s*/).map((s) => s.trim()).filter(Boolean);
const foreignPart = (part) => !hasGeorgian(part) && /[A-Za-zЀ-ӿ]/.test(part);

/** The Georgian of a name, without the Russian or Latin written next to it; null when it has none. */
export function georgianOf(name) {
  if (!hasGeorgian(name)) return null;
  const parts = nameParts(name);
  return parts.some(foreignPart) ? parts.filter((p) => !foreignPart(p)).join(' ') : name;
}

/** Names that only say what the thing is ("Tba" is "lake"): such a feature has no name. */
const GENERIC_NAMES = new Set([
  'lake', 'tba', 'small lake', 'patara tba', 'reservoir', 'tsqalsatsavi', 'pond',
  'waterfall', 'small waterfall', 'big waterfall', 'chanchkeri', 'patara chanchkeri', 'didi chanchkeri',
  'peak', 'summit', 'mountain', 'mount', 'top', 'mta', 'mtsvervali',
  'pass', 'saddle', 'ugheltekhili',
  'viewpoint', 'view', 'view point', 'panorama', 'khedi', 'gadasakhedi',
  'campsite', 'camping', 'camp', 'camp site', 'campground', 'wild camping', 'place for tents', 'kempingi',
  'hut', 'shelter', 'tavshesapari',
  'cave', 'mghvime', 'gamokvabuli',
  'canyon', 'kanioni', 'gorge', 'kheoba',
  'glacier', 'mqinvari',
  'castle', 'fortress', 'fort', 'tsikhe', 'tsikhesimagre', 'ruins', 'nangrevebi',
  'tower', 'koshki',
  'monastery', 'monasteri', 'mamata monasteri', 'dedata monasteri',
  'hot spring', 'hot springs', 'thermal spring', 'thermal springs',
  'fishing', 'fishing spot',
]);
export const isGenericName = (name) =>
  GENERIC_NAMES.has(name.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim());

/**
 * { name_en, name_ka } of a feature, or null when it has no name and its kind needs one (a name that only says
 * what the thing is does not count).
 * name_en: name:en, int_name, the name romanised (Georgian national system, or Russian; a Latin part of a
 * Russian name as it is), the name as it is; name_ka: the Georgian of the name, else name:ka.
 */
export function placeNames(tags, kind) {
  const name = clean(tags.name);
  const georgian = georgianOf(name) ?? clean(tags['name:ka']);
  const name_ka = georgian && !isGenericName(romanize(georgian)) ? georgian : null;
  const candidates = [clean(tags['name:en']), clean(tags.int_name)].filter(isLatin);
  if (hasGeorgian(name)) candidates.push(romanize(georgianOf(name)));
  else if (hasCyrillic(name)) candidates.push(nameParts(name).find(isLatin) ?? romanizeRu(name));
  else if (name) candidates.push(name);
  if (hasGeorgian(name_ka)) candidates.push(romanize(name_ka));
  const name_en = candidates.find((n) => !isGenericName(n)) ?? UNNAMED[kind] ?? null;
  return name_en ? { name_en, name_ka } : null;
}

/** Metres from a numeric `ele` tag ("2350", "2350.5", "2350 m"), or null. */
export function parseEle(value) {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*m?\s*$/i.exec(String(value ?? ''));
  if (!m) return null;
  const n = Number(m[1]);
  return n >= -30 && n <= 5700 ? Math.round(n) : null;
}

/** { wikidata: "Q…", wikipedia: "lang:Title" } from the tags (null when absent). */
export function wikiRefs(tags) {
  const qid = clean(String(tags.wikidata ?? '').split(';')[0]);
  let wikipedia = clean(tags.wikipedia);
  if (!wikipedia) {
    const key = Object.keys(tags).find((k) => /^wikipedia:[a-z-]+$/.test(k) && clean(tags[k]));
    if (key) wikipedia = `${key.slice('wikipedia:'.length)}:${clean(tags[key])}`;
  }
  return { wikidata: qid && /^Q\d+$/.test(qid) ? qid : null, wikipedia };
}

/** How well known a place is likely to be: links to Wikidata and Wikipedia, a sight, an English name, a photo, the kind. */
export function notability({ kind, tags, elevation_m }) {
  const { wikidata, wikipedia } = wikiRefs(tags);
  let score = KIND_WEIGHT[kind] ?? 0;
  if (kind === 'peak' && elevation_m != null && elevation_m >= 3000) score += 1;
  if (wikidata) score += 3;
  if (wikipedia) score += 3;
  if (tags.tourism === 'attraction') score += 2;
  if (clean(tags['name:en'])) score += 1;
  if (clean(tags.image) || clean(tags.wikimedia_commons)) score += 1;
  return score;
}

/** The few OSM tags worth keeping with a place (values trimmed, at most 300 characters). */
export function keptTags(tags) {
  const out = {};
  for (const key of KEPT_TAGS) {
    const value = clean(key === 'website' ? tags.website ?? tags['contact:website'] : tags[key]);
    if (value) out[key] = value.slice(0, 300);
  }
  return out;
}

/** Mean of the points ([lng, lat]); the caller passes each node once (a closed ring's last node is its first). */
export function centroid(points) {
  if (!points.length) return null;
  let lng = 0;
  let lat = 0;
  for (const p of points) {
    lng += p[0];
    lat += p[1];
  }
  return [lng / points.length, lat / points.length];
}

const M_PER_DEG = (6371008.8 * Math.PI) / 180;

/**
 * Whether a point ([lng, lat]) is on Georgian-controlled ground: not in an occupied territory, and in Georgia or
 * within toleranceM of it (eight points around it are tried), as summits and passes on the border ridge are.
 */
export function inTerritory(p, { inCountry, inOccupied }, toleranceM = BORDER_TOLERANCE_M) {
  if (inOccupied(p)) return false;
  if (inCountry(p)) return true;
  const dLat = toleranceM / M_PER_DEG;
  const dLng = dLat / Math.cos((p[1] * Math.PI) / 180);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const q = [p[0] + dLng * Math.cos(a), p[1] + dLat * Math.sin(a)];
    if (inCountry(q) && !inOccupied(q)) return true;
  }
  return false;
}

/** Trail starts ({ region, point: [lng, lat] }) from content/trails.json. */
export function trailStarts(dataset) {
  return dataset.trails
    .map((t) => ({ region: t.region ?? null, point: Array.isArray(t.start_point) ? t.start_point : t.route?.[0] }))
    .filter((s) => s.region && Array.isArray(s.point));
}

/** The region of the nearest trail start within maxKm, or null. */
export function nearestRegion(point, starts, maxKm = REGION_RADIUS_KM) {
  let best = null;
  let bestM = maxKm * 1000;
  for (const s of starts) {
    const d = haversineM(point, s.point);
    if (d <= bestM) {
      bestM = d;
      best = s.region;
    }
  }
  return best;
}

const TYPE_RANK = { relation: 0, way: 1, node: 2 };

/** Most notable first; on a tie an area before a point, then the lower OSM id. */
export function byNotability(a, b) {
  return b.notability - a.notability || TYPE_RANK[a.osm_type] - TYPE_RANK[b.osm_type] || a.osm_id - b.osm_id;
}

/** Places of the same kind and English name (any case) within radiusM of each other: only the most notable stays. */
export function dedupe(places, radiusM = DEDUPE_RADIUS_M) {
  const groups = new Map();
  for (const p of places) {
    const key = `${p.kind}|${p.name_en.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const kept = [];
  for (const group of groups.values()) {
    const winners = [];
    for (const p of [...group].sort(byNotability)) {
      const near = winners.some((w) => haversineM([w.longitude, w.latitude], [p.longitude, p.latitude]) <= radiusM);
      if (!near) winners.push(p);
    }
    kept.push(...winners);
  }
  return kept;
}

/** Output order: kind (as in KINDS), most notable first, then by name. */
export function compareForOutput(a, b) {
  return (
    KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) ||
    b.notability - a.notability ||
    a.name_en.localeCompare(b.name_en, 'en') ||
    TYPE_RANK[a.osm_type] - TYPE_RANK[b.osm_type] ||
    a.osm_id - b.osm_id
  );
}

/** Cache key of an elevation lookup: the coordinates rounded to 4 decimals (~10 m), as they are sent. */
export const elevationKey = (lat, lng) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

/** Open-Meteo elevation request for up to 100 cache keys. */
export function elevationUrl(keys) {
  const pairs = keys.map((k) => k.split(','));
  return `https://api.open-meteo.com/v1/elevation?latitude=${pairs.map((p) => p[0]).join(',')}&longitude=${pairs.map((p) => p[1]).join(',')}`;
}

const round7 = (n) => Math.round(n * 1e7) / 1e7;

/** One entry of content/places.json. */
export function placeRecord({ osm_type, osm_id, kind, names: n, point, elevation_m, region, tags }) {
  const record = {
    osm_type, osm_id, kind, name_en: n.name_en, name_ka: n.name_ka,
    latitude: round7(point[1]), longitude: round7(point[0]), elevation_m, region,
    ...wikiRefs(tags), tags: keptTags(tags), notability: 0,
  };
  record.notability = notability({ kind, tags, elevation_m });
  return record;
}

/** What is wrong with a places.json entry (an empty list when nothing). */
export function placeProblems(p) {
  const problems = [];
  if (!['node', 'way', 'relation'].includes(p.osm_type)) problems.push(`osm_type ${p.osm_type}`);
  if (!Number.isSafeInteger(p.osm_id) || p.osm_id <= 0) problems.push(`osm_id ${p.osm_id}`);
  if (!KINDS.includes(p.kind)) problems.push(`kind ${p.kind}`);
  if (typeof p.name_en !== 'string' || !p.name_en.trim()) problems.push('no name_en');
  if (!Number.isFinite(p.latitude) || Math.abs(p.latitude) > 90) problems.push(`latitude ${p.latitude}`);
  if (!Number.isFinite(p.longitude) || Math.abs(p.longitude) > 180) problems.push(`longitude ${p.longitude}`);
  if (p.elevation_m != null && !Number.isInteger(p.elevation_m)) problems.push(`elevation_m ${p.elevation_m}`);
  if (!Number.isInteger(p.notability) || p.notability < 0 || p.notability > 32767) problems.push(`notability ${p.notability}`);
  if (!p.tags || typeof p.tags !== 'object' || Array.isArray(p.tags)) problems.push('tags');
  return problems;
}

const ROW_COLUMNS = [
  'osm_type', 'osm_id', 'kind', 'name_en', 'name_ka', 'latitude', 'longitude', 'elevation_m', 'region', 'wikidata',
  'wikipedia', 'tags', 'notability',
];

/** The public.places row for an entry: every column present (PostgREST bulk inserts want the same keys in each row). */
export function placeRow(p, updatedAt) {
  const row = {};
  for (const c of ROW_COLUMNS) row[c] = p[c] ?? (c === 'tags' ? {} : null);
  row.updated_at = updatedAt;
  return row;
}

export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
