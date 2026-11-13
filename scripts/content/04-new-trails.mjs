// Step 4 — hiking route relations in Georgia that are not in the catalogue yet, with the quality
// gates from the brief applied (the elevation gate is applied in step 5).
// Output: content/work/new-geometry.json  { accepted: [...], rejected: [...] }
//
//   node scripts/content/04-new-trails.mjs [--table]
import path from 'node:path';
import { roundCoord } from './lib/ewkt.mjs';
import { LineIndex, bbox, bboxesIntersect, haversineM, lineLengthM, overlapShare, sampleAlong, simplifyToMaxPoints } from './lib/geo.mjs';
import { cleanName, hasCyrillic, hasGeorgian, isLatin, romanizeKa } from './lib/names.mjs';
import { DATA, WORK, readJson, readJsonIfExists, writeJson } from './lib/paths.mjs';
import { distanceToBorderM, distanceToOccupiedM, inGeorgia, occupiedAreaAt } from './lib/regions.mjs';
import { stitchWays } from './lib/stitch.mjs';
import { trailIdForRelation } from './lib/uuid.mjs';
import { Features, destinationVote, directionVotes, nameParts, placeNear } from './lib/features.mjs';

const MAX_POINTS = 600;
const MIN_KM = 2;
const MAX_KM = 120;
const OCCUPATION_LINE_MARGIN_M = 1000;

const { relations } = readJson(path.join(WORK, 'osm-relations.json'));
const existing = readJson(path.join(WORK, 'existing-geometry.json'));
const relationMap = readJson(path.join(DATA, 'relation-map.json'));
const overrides = readJsonIfExists(path.join(DATA, 'geometry-overrides.json'), {});
const newOverrides = readJsonIfExists(path.join(DATA, 'new-trail-overrides.json'), {});

// relations that already back a catalogue trail
const used = new Map();
for (const [trailId, m] of Object.entries(relationMap)) for (const id of m.relations) used.set(id, trailId);
for (const [trailId, ov] of Object.entries(overrides)) {
  for (const id of ov.relations ?? []) used.set(id, trailId);
  for (const p of ov.parts ?? []) if (!p.from && !p.to) used.set(p.relation, trailId);
}

const GENERIC_NAME = /^(local( path)?( trial| trail)?|for permit|trail|path|route|hiking trail|planned route|unnamed|black|red|blue|green|yellow)$/i;

function displayNames(tags) {
  const en = tags['name:en'] ?? (isLatin(tags.name) ? tags.name : null) ?? tags.int_name ?? null;
  const ka = tags['name:ka'] ?? (hasGeorgian(tags.name) ? tags.name : null);
  let nameEn = en ? cleanName(en) : ka ? { ...cleanName(romanizeKa(ka)), transliterated: true } : null;
  return { nameEn, nameKa: ka ? ka.trim() : null };
}

// existing catalogue geometry (final routes) for duplicate checks
const catalogue = Object.values(existing).map((e) => ({
  id: e.id,
  name: e.name,
  coords: e.full ?? e.route,
  box: bbox(e.full ?? e.route),
  lengthKm: e.final.length_km,
  measurable: e.measurable,
}));
for (const c of catalogue) c.index = new LineIndex(c.coords);

const accepted = [];
const rejected = [];
const reject = (rel, reason, extra = {}) => rejected.push({ relation: rel.id, name: rel.tags.name ?? rel.tags['name:en'] ?? null, reason, ...extra });

const candidates = Object.values(relations)
  .filter((r) => r.in_discovery)
  .sort((a, b) => a.id - b.id);

const prepared = [];
for (const rel of candidates) {
  const tags = rel.tags;
  if (used.has(rel.id)) continue; // already in the catalogue — handled by step 3
  const ov = newOverrides[rel.id] ?? {};
  if (ov.reject) {
    reject(rel, `rejected by hand: ${ov.reject}`);
    continue;
  }
  if (tags.type === 'superroute' || (!rel.ways.length && rel.subrelations.length)) {
    reject(rel, 'a super-route made of other relations (its stages are judged on their own)');
    continue;
  }
  const { nameEn, nameKa } = displayNames(tags);
  if (!nameEn || !nameEn.name) {
    reject(rel, hasCyrillic(tags.name) ? 'no Latin or Georgian name (Cyrillic only)' : 'no name');
    continue;
  }
  if (GENERIC_NAME.test(nameEn.name) || /planned route|no trail yet/i.test(tags.name ?? '')) {
    reject(rel, `no usable name ("${tags.name}")`);
    continue;
  }
  if (/^(proposed|planned)$/i.test(tags.state ?? '') || tags.proposed === 'yes') {
    reject(rel, 'tagged as proposed/planned');
    continue;
  }
  const st = stitchWays(rel.ways, { maxGapM: 150 });
  if (!st.ok) {
    reject(rel, `members do not form one continuous line: ${st.reason}`);
    continue;
  }
  const lengthKm = lineLengthM(st.coords) / 1000;
  if (lengthKm < MIN_KM || lengthKm > MAX_KM) {
    reject(rel, `length ${lengthKm.toFixed(1)} km is outside ${MIN_KM}–${MAX_KM} km`);
    continue;
  }
  const outside = st.coords.find((c) => !inGeorgia(c));
  const occupied = st.coords.map(occupiedAreaAt).find(Boolean);
  if (occupied) {
    reject(rel, `runs through ${occupied}`);
    continue;
  }
  if (outside) {
    reject(rel, 'crosses the national border');
    continue;
  }
  const samples = sampleAlong(st.coords, 250, 800).map((s) => s.p);
  const toLine = distanceToOccupiedM(samples, 5000);
  if (toLine < OCCUPATION_LINE_MARGIN_M) {
    reject(rel, `comes within ${Math.round(toLine)} m of the occupation line`);
    continue;
  }
  prepared.push({ rel, st, lengthKm, nameEn, nameKa, samples, ov });
}

// longest first, so a trek is kept in one piece and its sub-stages are judged against it
prepared.sort((a, b) => b.lengthKm - a.lengthKm);
const pool = catalogue.slice();
const features = new Features(readJson(path.join(WORK, 'osm-pois.json')).pois);
for (const c of prepared) {
  const { rel, st, lengthKm } = c;
  const box = bbox(st.coords);
  let dup = null;
  for (const other of pool) {
    if (!bboxesIntersect(box, other.box, 0.003)) continue;
    const sameEnds =
      (haversineM(st.coords[0], other.coords[0]) < 300 && haversineM(st.coords[st.coords.length - 1], other.coords[other.coords.length - 1]) < 300) ||
      (haversineM(st.coords[0], other.coords[other.coords.length - 1]) < 300 && haversineM(st.coords[st.coords.length - 1], other.coords[0]) < 300);
    if (sameEnds && Math.abs(lengthKm - other.lengthKm) <= 0.15 * other.lengthKm) {
      dup = { other, why: `same ends and length as "${other.name}"` };
      break;
    }
    const share = overlapShare(st.coords, other.index, 100, 100);
    if (share >= 0.8 && other.measurable !== false) {
      dup = { other, why: `${Math.round(share * 100)}% of it runs along "${other.name}"` };
      break;
    }
  }
  if (dup && !c.ov.keep) {
    reject(rel, `duplicate or variant of a catalogue trail: ${dup.why}`, { of: dup.other.id });
    continue;
  }
  const parts = nameParts(c.nameEn.name);
  let dir = directionVotes(features, st.coords, [rel.tags.from, parts.length > 1 ? parts[0] : null], [rel.tags.to, parts.length > 1 ? parts[parts.length - 1] : null]);
  if (!dir.why.length && parts.length < 2) dir = destinationVote(features, st.coords, c.nameEn.name);
  if (dir.reverse) st.coords = st.coords.slice().reverse();
  const simp = simplifyToMaxPoints(st.coords, MAX_POINTS);
  const id = trailIdForRelation(rel.id);
  const entry = {
    id,
    osm_relation_id: rel.id,
    name_en: c.nameEn.name,
    name_en_transliterated: !!c.nameEn.transliterated,
    name_ka: c.nameKa,
    unmarked: c.nameEn.unmarked,
    tags: rel.tags,
    shape: st.shape,
    stitch: { method: st.method, max_gap_m: st.maxGapM ?? 0, dropped_m: st.droppedM ?? 0 },
    length_km: Math.round(lengthKm * 100) / 100,
    route: simp.coords.map(roundCoord),
    full: st.coords.map(roundCoord),
    simplify_tolerance_m: simp.toleranceM,
    occupation_line_km: toKm(distanceToOccupiedM(c.samples, 20000)),
    border_km: toKm(distanceToBorderM(c.samples, 20000)),
  };
  accepted.push(entry);
  pool.push({ id, name: entry.name_en, coords: st.coords, box, lengthKm, index: new LineIndex(st.coords), measurable: true });
}

function toKm(m) {
  return m === Infinity ? null : Math.round(m / 100) / 10;
}

// Several relations with the same name are separate pieces of one trek: tell them apart by their ends.
const byName = new Map();
for (const a of accepted) byName.set(a.name_en, [...(byName.get(a.name_en) ?? []), a]);
for (const group of byName.values()) {
  if (group.length < 2) continue;
  group.sort((x, y) => y.length_km - x.length_km);
  for (const a of group) {
    const from = placeNear(features, a.full[0], 2000)?.en;
    const to = placeNear(features, a.full[a.full.length - 1], 2000)?.en;
    if (from && to && from !== to) {
      a.name_en = `${a.name_en} (${from} - ${to})`;
      a.renamed_piece = true;
    } else if (a !== group[0]) {
      accepted.splice(accepted.indexOf(a), 1);
      rejected.push({ relation: a.osm_relation_id, name: a.tags.name, reason: `a shorter piece of "${group[0].name_en}" whose ends have no place names to tell it apart` });
    }
  }
}

accepted.sort((a, b) => a.osm_relation_id - b.osm_relation_id);
writeJson(path.join(WORK, 'new-geometry.json'), { accepted, rejected });
console.log(`candidates not in the catalogue: ${accepted.length + rejected.length}; accepted ${accepted.length}, rejected ${rejected.length}`);
if (process.argv.includes('--table')) {
  for (const a of accepted) console.log(['OK', a.osm_relation_id, a.length_km + 'km', a.shape, a.stitch.method, `gap${a.stitch.max_gap_m}`, `drop${a.stitch.dropped_m}`, `occ${a.occupation_line_km ?? '>20'}km`, `border${a.border_km ?? '>20'}km`, a.name_en, a.name_ka ?? '', a.unmarked ? '[unmarked]' : '', a.tags.network ?? ''].join(' | '));
  for (const r of rejected) console.log(['NO', r.relation, r.name ?? '(unnamed)', r.reason].join(' | '));
}
