// Step 3 — geometry sanity of every existing trail and, where its OSM relation is known and
// stitches into one clean line, a rebuilt route (Douglas–Peucker, <= 600 points).
// Nothing is guessed: a trail whose relation does not stitch, or whose stored route does not
// lie on the mapped relation, keeps its stored route and is flagged for manual review.
// Inputs:  snapshot, data/relation-map.json, data/geometry-overrides.json, work/osm-relations.json
// Output:  content/work/existing-geometry.json
//
//   node scripts/content/03-existing-geometry.mjs [--table]
import path from 'node:path';
import { geoJsonCoords, roundCoord } from './lib/ewkt.mjs';
import {
  LineIndex, haversineM, lineLengthM, maxSegmentM, sampleAlong, simplifyToMaxPoints,
} from './lib/geo.mjs';
import { sameToponym, latinNames } from './lib/names.mjs';
import { DATA, WORK, latestSnapshotPath, readJson, readJsonIfExists, writeJson } from './lib/paths.mjs';
import { inGeorgia, occupiedAreaAt } from './lib/regions.mjs';
import { Features, destinationVote, directionVotes, nameParts } from './lib/features.mjs';
import { orientLike, pathBetween, stitchWays } from './lib/stitch.mjs';

const MAX_POINTS = 600;
const MAX_GAP_M = 150;
const JUMP_M = 1500;

const snapshot = readJson(latestSnapshotPath());
const relationMap = readJson(path.join(DATA, 'relation-map.json'));
const overrides = readJsonIfExists(path.join(DATA, 'geometry-overrides.json'), {});
const { relations } = readJson(path.join(WORK, 'osm-relations.json'));
const { pois } = readJson(path.join(WORK, 'osm-pois.json'));
const places = pois.filter((p) => p.kind === 'place');

function placeNear(name, ways) {
  // the named settlement closest to the relation's ways
  const index = new LineIndex(ways.flatMap((w) => w.coords));
  let best = null;
  for (const p of places) {
    if (!latinNames(p).some((n) => sameToponym(n, name))) continue;
    const d = index.distanceWithin(p.coord, 3000);
    if (d !== Infinity && (!best || d < best.d)) best = { d, p };
  }
  return best;
}

function anchor(spec, ways) {
  if (Array.isArray(spec)) return { coord: spec, label: `${spec[1]},${spec[0]}` };
  const hit = placeNear(spec, ways);
  if (!hit) return null;
  return { coord: hit.p.coord, label: `${spec} (${hit.p.osm}, ${Math.round(hit.d)} m from the ways)` };
}

/** Joins stitched lines end to end in the given order, flipping each as needed. */
function joinLines(lines) {
  let out = lines[0].coords;
  let maxGap = 0;
  if (lines.length > 1) {
    const next = lines[1].coords;
    const tailD = Math.min(haversineM(out[out.length - 1], next[0]), haversineM(out[out.length - 1], next[next.length - 1]));
    const headD = Math.min(haversineM(out[0], next[0]), haversineM(out[0], next[next.length - 1]));
    if (headD < tailD) out = out.slice().reverse();
  }
  for (let i = 1; i < lines.length; i++) {
    let seg = lines[i].coords;
    const tail = out[out.length - 1];
    if (haversineM(tail, seg[seg.length - 1]) < haversineM(tail, seg[0])) seg = seg.slice().reverse();
    const gap = haversineM(tail, seg[0]);
    if (gap > MAX_GAP_M) return { ok: false, reason: `relations do not join end to end (gap ${Math.round(gap)} m)` };
    maxGap = Math.max(maxGap, gap);
    out = out.concat(gap < 0.01 ? seg.slice(1) : seg);
  }
  return { ok: true, coords: out, shape: 'line', method: 'joined-relations', maxGapM: Math.round(maxGap), droppedM: lines.reduce((n, l) => n + (l.droppedM ?? 0), 0) };
}

function osmCandidate(trailId) {
  const ov = overrides[trailId] ?? {};
  if (ov.keep) return { skip: `override: ${ov.why}` };
  if (ov.parts) {
    const relationIds = [...new Set(ov.parts.map((p) => p.relation))];
    const lines = [];
    const segments = [];
    const alternatives = [];
    for (const part of ov.parts) {
      const rel = relations[part.relation];
      if (!rel) return { fail: `relation ${part.relation} is no longer in OSM`, relationIds };
      if (!part.from && !part.to) {
        const whole = stitchWays(rel.ways, { maxGapM: MAX_GAP_M });
        if (!whole.ok) return { fail: `relation ${rel.id}: ${whole.reason}`, relationIds };
        lines.push(whole);
        continue;
      }
      const from = anchor(part.from, rel.ways);
      const to = anchor(part.to, rel.ways);
      if (!from || !to) return { fail: `anchor not found near relation ${rel.id}: ${JSON.stringify(!from ? part.from : part.to)}`, relationIds };
      const res = pathBetween(rel.ways, from.coord, to.coord, { maxGapM: MAX_GAP_M, maxSnapM: part.maxSnapM ?? 600 });
      if (!res.ok) return { fail: `relation ${rel.id}: ${res.reason}`, relationIds };
      lines.push(res);
      segments.push(`${from.label} → ${to.label} on relation ${rel.id}`);
      alternatives.push(...res.alternatives);
    }
    const res = lines.length === 1 ? lines[0] : joinLines(lines);
    if (!res.ok) return { fail: res.reason, relationIds };
    return {
      ...res,
      method: lines.length === 1 ? res.method : 'joined-relations',
      maxGapM: Math.max(res.maxGapM ?? 0, ...lines.map((l) => l.maxGapM ?? 0)),
      relationIds,
      segment: segments.length ? segments.join('; ') : null,
      alternatives,
      confirmed: true,
      fixedOrientation: true,
    };
  }
  const ids = ov.relations ?? relationMap[trailId]?.relations ?? [];
  if (!ids.length) return { none: true };
  const missing = ids.filter((id) => !relations[id]);
  if (missing.length) return { fail: `relation ${missing.join(', ')} is no longer in OSM`, relationIds: ids };
  const parts = ids.map((id) => stitchWays(relations[id].ways, { maxGapM: MAX_GAP_M }));
  const bad = parts.findIndex((p) => !p.ok);
  if (bad >= 0) return { fail: `relation ${ids[bad]}: ${parts[bad].reason}`, relationIds: ids };
  const res = parts.length === 1 ? parts[0] : joinLines(parts);
  if (!res.ok) return { fail: res.reason, relationIds: ids };
  return { ...res, relationIds: ids, confirmed: !!ov.confirmed, fixedOrientation: ov.reverse !== undefined, reverse: ov.reverse };
}

const features = new Features(pois);

/** Should the line run the other way? Votes from the trail name ("A - B", "A to B") and its first/last checkpoint. */
function travelDirection(t, line) {
  const cps = [...(t.checkpoints ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const parts = nameParts(t.name_en);
  const starts = [cps[0]?.name_en, parts.length > 1 ? parts[0] : null];
  const ends = [cps.length > 1 ? cps[cps.length - 1].name_en : null, parts.length > 1 ? parts[parts.length - 1] : null];
  const dir = directionVotes(features, line, starts, ends);
  // nothing to go by but a one-part name such as "Leiraki Waterfall Trail": walk towards the destination
  if (!dir.why.length && parts.length < 2) {
    const d = destinationVote(features, line, t.name_en);
    if (d.score) return d;
  }
  return dir;
}

const out = {};
const table = [];
for (const t of snapshot.trails) {
  const stored = geoJsonCoords(t.route) ?? [];
  const startPoint = geoJsonCoords(t.start_point);
  const endPoint = geoJsonCoords(t.end_point);
  const ov = overrides[t.id] ?? {};
  const flags = [];

  // ---- stored geometry sanity ----
  const lengthKm = lineLengthM(stored) / 1000;
  const jump = maxSegmentM(stored);
  const outside = stored.filter((c) => !inGeorgia(c) || occupiedAreaAt(c)).length;
  const s = {
    points: stored.length,
    length_km: Math.round(lengthKm * 100) / 100,
    max_segment_m: Math.round(jump.max),
    start_offset_m: startPoint && stored.length ? Math.round(haversineM(startPoint, stored[0])) : null,
    end_offset_m: endPoint && stored.length ? Math.round(haversineM(endPoint, stored[stored.length - 1])) : null,
    outside_georgia_points: outside,
    stored_distance_km: Number(t.distance_km),
  };
  const broken = [];
  if (stored.length < 20 && lengthKm < 0.6 * s.stored_distance_km) broken.push(`only ${stored.length} points covering ${lengthKm.toFixed(1)} km of a ${s.stored_distance_km} km trail`);
  if (jump.max > JUMP_M) broken.push(`jump of ${(jump.max / 1000).toFixed(1)} km between consecutive points`);
  if (outside) broken.push(`${outside} points outside Georgian-controlled territory`);
  if ((s.start_offset_m ?? 0) > 100 || (s.end_offset_m ?? 0) > 100) flags.push('start_point/end_point do not match the route ends');
  s.broken = broken;

  // ---- OSM candidate ----
  const cand = osmCandidate(t.id);
  const entry = { id: t.id, name: t.name_en, stored: s, osm: null, identity: null, decision: 'kept', reason: '', flags, route: stored.map(roundCoord), shape: null };

  if (cand.skip) {
    entry.reason = cand.skip;
  } else if (cand.none) {
    entry.reason = 'no OSM relation is known for this trail';
  } else if (cand.fail) {
    const waysKm = (cand.relationIds ?? []).reduce((n, id) => n + (relations[id]?.ways ?? []).reduce((m, w) => m + lineLengthM(w.coords), 0), 0) / 1000;
    entry.osm = { relations: cand.relationIds ?? [], ok: false, reason: cand.fail, ways_total_km: Math.round(waysKm * 10) / 10 };
    entry.reason = `OSM relation cannot be turned into one clean line: ${cand.fail}`;
    if (waysKm > 1 && (lengthKm < 0.5 * waysKm || lengthKm > 1.5 * waysKm)) {
      broken.push(`stored line is ${lengthKm.toFixed(1)} km while the relation's ways add up to ${waysKm.toFixed(1)} km`);
    }
  } else {
    const osmLenKm = lineLengthM(cand.coords) / 1000;
    const osmIndex = new LineIndex(cand.coords);
    const onOsm = stored.length ? stored.filter((c) => osmIndex.distanceWithin(c, 150) !== Infinity).length / stored.length : 0;
    // how much of the OSM line has a stored vertex nearby
    const spacing = stored.length > 1 ? (lengthKm * 1000) / (stored.length - 1) : Infinity;
    const reach = Math.max(300, Math.min(600, spacing * 1.5));
    const samples = sampleAlong(cand.coords, 100, 2000);
    const cell = 0.01;
    const grid = new Map();
    for (const c of stored) {
      const k = `${Math.floor(c[0] / cell)},${Math.floor(c[1] / cell)}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(c);
    }
    let covered = 0;
    for (const smp of samples) {
      const gx = Math.floor(smp.p[0] / cell);
      const gy = Math.floor(smp.p[1] / cell);
      let hit = false;
      for (let x = gx - 1; x <= gx + 1 && !hit; x++)
        for (let y = gy - 1; y <= gy + 1 && !hit; y++)
          for (const c of grid.get(`${x},${y}`) ?? []) {
            if (haversineM(c, smp.p) <= reach) {
              hit = true;
              break;
            }
          }
      if (hit) covered++;
    }
    const osmCovered = covered / samples.length;
    entry.identity = { stored_points_on_osm_line: Math.round(onOsm * 100) / 100, osm_line_covered_by_stored: Math.round(osmCovered * 100) / 100 };
    entry.osm = {
      relations: cand.relationIds, ok: true, method: cand.method, shape: cand.shape, length_km: Math.round(osmLenKm * 100) / 100,
      raw_points: cand.coords.length, max_gap_m: cand.maxGapM ?? 0, dropped_m: cand.droppedM ?? 0,
      ...(cand.segment ? { segment: cand.segment, alternatives: cand.alternatives } : {}),
    };

    const geometric = stored.length >= 20 && onOsm >= 0.7 && osmCovered >= 0.7;
    const identityOk = cand.confirmed || geometric;
    const coarse = osmLenKm > lengthKm * 1.02 || lengthKm > osmLenKm * 1.02 || stored.length < Math.min(cand.coords.length, 100);

    if (!identityOk) {
      entry.reason = onOsm < 0.7
        ? `stored route does not follow the mapped relation (${Math.round(onOsm * 100)}% of its points are on it)`
        : `stored route covers only ${Math.round(osmCovered * 100)}% of the mapped relation`;
    } else if (!broken.length && !coarse && !ov.rebuild) {
      entry.reason = 'stored route already matches the OSM line';
    } else {
      // rebuild
      let line = cand;
      if (cand.fixedOrientation) {
        if (cand.reverse) line = { ...cand, coords: cand.coords.slice().reverse() };
      } else if (geometric && !broken.length) {
        const q = stored[Math.floor(stored.length / 4)];
        line = orientLike(cand, stored[0], stored[stored.length - 1], q);
      } else if (geometric) {
        // tangled stored line: its first and last points are still the best hint of direction
        line = orientLike(cand, stored[0], stored[stored.length - 1], null);
      }
      const simp = simplifyToMaxPoints(line.coords, MAX_POINTS);
      entry.decision = 'rebuilt';
      entry.shape = line.shape;
      entry.route = simp.coords.map(roundCoord);
      entry.full = line.coords.map(roundCoord);
      entry.simplify_tolerance_m = simp.toleranceM;
      entry.reason = `${broken.length ? `stored route broken (${broken.join('; ')})` : 'stored route coarse (300-point decimation)'} — rebuilt from OSM relation ${cand.relationIds.join(' + ')}${cand.segment ? ` [${cand.segment}]` : ''} (${cand.method})`;
      if (cand.droppedM > 0) flags.push(`side spurs of the relation not included: ${cand.droppedM} m`);
      if (cand.maxGapM > 1) flags.push(`OSM ways joined across a gap of ${cand.maxGapM} m`);
      if (cand.segment && cand.alternatives?.some((a) => a.replacesM > 500)) {
        flags.push(`review: the relation offers a variant for ${cand.alternatives.filter((a) => a.replacesM > 500).map((a) => `${(a.replacesM / 1000).toFixed(1)} km`).join(', ')} of this line; the shorter way was taken`);
      }
      if (ov.why) flags.push(`identified by hand: ${ov.why}`);
    }
  }

  if (entry.decision === 'kept') {
    if (broken.length) flags.push(`manual review: stored route is broken (${broken.join('; ')}) and could not be rebuilt — ${entry.reason}`);
    else if (entry.osm && !entry.osm.ok) flags.push(`manual review: ${entry.reason}`);
    else if (entry.identity && !/already matches/.test(entry.reason)) flags.push(`manual review: ${entry.reason}`);
    const closed = stored.length > 3 && haversineM(stored[0], stored[stored.length - 1]) < 150;
    entry.shape = closed ? 'loop' : 'line';
  }
  entry.manual_review = flags.some((f) => f.startsWith('manual review'));
  // A kept line can still be measured when nothing is wrong with it except that its relation is gone.
  const onlyRelationGone = entry.manual_review && !broken.length && /no longer in OSM/.test(entry.reason);
  entry.measurable = entry.decision === 'rebuilt' || !entry.manual_review || onlyRelationGone;
  // Lines that are left for manual review are not touched at all, not even reversed.
  let dir = { reverse: false, score: 0, why: [entry.measurable ? 'orientation fixed by the override' : 'not measurable'] };
  if (entry.measurable && ov.start) {
    const a = anchor(ov.start, [{ coords: entry.route }]);
    if (a) dir = { reverse: haversineM(a.coord, entry.route[entry.route.length - 1]) < haversineM(a.coord, entry.route[0]), score: 0, why: [`starts near ${a.label} (set by hand)`] };
  } else if (entry.measurable && !cand.fixedOrientation) dir = travelDirection(t, entry.route);
  entry.direction = dir;
  if (dir.reverse) {
    entry.route = entry.route.slice().reverse();
    if (entry.full) entry.full = entry.full.slice().reverse();
    entry.reversed = true;
    flags.push(`route reversed to run in the direction of the trail name (${dir.why.join('; ')})`);
  }

  const final = entry.route;
  entry.final = {
    points: final.length,
    length_km: Math.round((lineLengthM(entry.full ?? final) / 1000) * 100) / 100,
    route_length_km: Math.round((lineLengthM(final) / 1000) * 100) / 100,
    max_segment_m: Math.round(maxSegmentM(final).max),
    start: final[0],
    end: final[final.length - 1],
  };
  out[t.id] = entry;
  table.push([
    t.id.slice(-3), entry.decision, s.points, s.length_km, s.stored_distance_km, s.max_segment_m,
    entry.osm ? (entry.osm.ok ? `${entry.osm.method}/${entry.osm.shape} ${entry.osm.length_km}km gap${entry.osm.max_gap_m} drop${entry.osm.dropped_m}` : 'FAIL') : '-',
    entry.identity ? `${entry.identity.stored_points_on_osm_line}/${entry.identity.osm_line_covered_by_stored}` : '-',
    `${entry.final.points}pts ${entry.final.length_km}km max${entry.final.max_segment_m}`,
    t.name_en, entry.decision === 'kept' ? entry.reason.slice(0, 110) : '',
  ].join(' | '));
}

writeJson(path.join(WORK, 'existing-geometry.json'), out);
const count = (d) => Object.values(out).filter((e) => e.decision === d).length;
console.log(`existing trails: ${Object.keys(out).length}; rebuilt ${count('rebuilt')}, kept ${count('kept')} (${Object.values(out).filter((e) => e.manual_review).length} flagged for manual review, ${Object.values(out).filter((e) => !e.measurable).length} not measurable)`);
if (process.argv.includes('--table')) {
  console.log('id | decision | pts | lenKm | storedKm | maxSeg | osm | onOsm/covered | final | name | reason');
  console.log(table.join('\n'));
}
