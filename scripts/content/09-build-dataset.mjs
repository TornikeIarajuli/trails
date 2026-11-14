// Step 9 — the canonical dataset content/trails.json: every existing trail with corrected values
// (and why), every accepted new trail, checkpoints, photos.
// Inputs: snapshot, work/existing-geometry.json, work/elevation.json, work/new-geometry.json,
//         work/osm-pois.json, work/osm-relations.json, work/photos.json (optional), data/*.json
// Output: content/trails.json, content/work/build-report.json
//
//   node scripts/content/09-build-dataset.mjs
import fs from 'node:fs';
import path from 'node:path';
import { REVIEW_FLAG_CODES, routeSignature } from './apply-lib.mjs';
import { routeKey, writeDataset } from './lib/dataset.mjs';
import { elevations } from './lib/dem.mjs';
import { geoJsonCoords, roundCoord } from './lib/ewkt.mjs';
import { FACILITY_KIND, Features, KINDS_FOR_TYPE, TYPE_FOR_KIND, endParts, englishLabel, featureLabel, hasProperName, labelMatches, placeNear } from './lib/features.mjs';
import { LineIndex, bbox, bboxesIntersect, cumulativeM, haversineM, lineLengthM, nearestOnLine, overlapShare, sampleAlong } from './lib/geo.mjs';
import { difficultyFor, difficultyGap, dinHours, elevationProfile, roundHours } from './lib/hiking.mjs';
import { cleanName, georgianName, hasGeorgian, latinNames, sameToponym } from './lib/names.mjs';
import { DATA, WORK, latestSnapshotPath, readJson, readJsonIfExists, writeJson } from './lib/paths.mjs';
import { distanceToBorderM, distanceToOccupiedM, distanceToTbilisiM, regionProfile } from './lib/regions.mjs';
import { terrainNote } from './lib/terrain.mjs';
import { checkpointId } from './lib/uuid.mjs';

const snapshotPath = latestSnapshotPath();
const snapshot = readJson(snapshotPath);
const geom = readJson(path.join(WORK, 'existing-geometry.json'));
const elev = readJsonIfExists(path.join(WORK, 'elevation.json'), {});
const newGeom = readJsonIfExists(path.join(WORK, 'new-geometry.json'), { accepted: [], rejected: [] });
const { pois } = readJson(path.join(WORK, 'osm-pois.json'));
const { relations } = readJson(path.join(WORK, 'osm-relations.json'));
const photos = readJsonIfExists(path.join(WORK, 'photos.json'), { trails: {} });
const relationMap = readJson(path.join(DATA, 'relation-map.json'));
const geomOverrides = readJsonIfExists(path.join(DATA, 'geometry-overrides.json'), {});
const textOverrides = readJsonIfExists(path.join(DATA, 'text-overrides.json'), {});
const features = new Features(pois);

const STUB_EN = /^Hiking trail in the .+ region of Georgia\.?$/i;
const STUB_KA = /^სალაშქრო ბილიკი .*-ში\.?$/;
const TBILISI_AREA_M = 15000;
const r1 = (x) => Math.round(x * 10) / 10;
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const georgianAuthored = [];
const report = { existing: [], fresh: [], rejected: newGeom.rejected, checkpoints: [], difficultyOverrides: [], regionChanges: [], nameChanges: [] };

// ---------- helpers ----------

function relationIdsFor(id) {
  const ov = geomOverrides[id] ?? {};
  if (ov.parts) return [...new Set(ov.parts.map((p) => p.relation))];
  return ov.relations ?? relationMap[id]?.relations ?? [];
}

function regionFor(line) {
  const samples = sampleAlong(line, 250, 200).map((s) => s.p);
  const prof = regionProfile(samples);
  const nearTbilisi = distanceToTbilisiM([line[0]]) <= TBILISI_AREA_M;
  let computed = prof.start && prof.start === prof.mid ? prof.start : null;
  const top = Object.entries(prof.shares).sort((a, b) => b[1] - a[1])[0];
  if (!computed && top && top[0] !== '(outside)' && top[1] >= 0.8) computed = top[0];
  if (computed && computed !== 'Tbilisi' && nearTbilisi) computed = 'Tbilisi';
  return { prof, computed, nearTbilisi, majority: prof.majority === '(outside)' ? null : prof.majority };
}

function fixEnglishName(name) {
  let n = cleanName(name).name;
  n = n.replace(/\bTbilsi\b/g, 'Tbilisi').replace(/\bTail$/, 'Trail');
  return n;
}

/** Georgian name composed from the OSM features named in "A - B - C", or null. */
function composeKa(nameEn, line) {
  const parts = nameEn.split(' - ').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const near = features.nearLine(line, 2000);
  const out = [];
  const used = [];
  for (const part of parts) {
    const words = part.split(/\s+/);
    let hit = null;
    for (const { f } of near) {
      const ka = georgianName(f);
      if (!ka) continue;
      const whole = latinNames(f).some((n) => n.toLowerCase() === part.toLowerCase() || (words.length === 1 && sameToponym(n, part)));
      const single = words.length === 1 && f.kind === 'place' && labelMatches(part, f);
      if (whole || single) {
        hit = { ka, f };
        break;
      }
    }
    if (!hit) return null;
    out.push(hit.ka.trim());
    used.push(`${part} = ${hit.ka.trim()} (${hit.f.osm})`);
  }
  return { ka: out.join(' - '), used };
}

function passesAlong(line, exclude) {
  const kinds = ['place', 'pass', 'peak', 'lake', 'waterfall', 'hut', 'church', 'tower', 'ruins', 'glacier'];
  const out = [];
  const seen = new Set(exclude.map((s) => s?.toLowerCase()).filter(Boolean));
  for (const n of features.nearLine(line, 150, kinds)) {
    const f = n.f;
    if (f.kind === 'place' && !/^(town|village|hamlet)$/.test(f.tags?.place ?? '')) continue;
    if (f.kind === 'peak' && n.distM > 60) continue;
    const label = englishLabel(f);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push(label);
    if (out.length >= 6) break;
  }
  return out;
}

function describeEn({ km, stats, from, to, loop, passes }) {
  let s;
  if (loop) s = `A ${km} km loop${from ? ` starting and ending near ${from}` : ''}.`;
  else if (from && to && from !== to) s = `A ${km} km route from ${from} to ${to}.`;
  else if (from) s = `A ${km} km route starting near ${from}.`;
  else s = `A ${km} km route.`;
  if (stats) s += ` Total ascent about ${fmt(stats.ascent_m)} m and descent about ${fmt(stats.descent_m)} m; the highest point is about ${fmt(stats.max_m)} m above sea level.`;
  if (passes.length) s += ` Along the way: ${passes.join(', ')}.`;
  return s;
}

function describeKa({ km, stats }) {
  let s = `მარშრუტის სიგრძეა ${km} კმ.`;
  if (stats) s += ` ჯამური აღმართი — დაახლოებით ${stats.ascent_m} მ, დაღმართი — დაახლოებით ${stats.descent_m} მ, უმაღლესი წერტილი — დაახლოებით ${stats.max_m} მ ზღვის დონიდან.`;
  return s;
}

function endLabels(nameEn, line) {
  const parts = endParts(nameEn);
  const from = placeNear(features, line[0], 1500);
  const to = placeNear(features, line[line.length - 1], 1500);
  return {
    from: from?.en ?? null,
    to: to?.en ?? null,
    startName: parts.length >= 2 ? `${parts[0]} Start` : 'Start',
    endName: parts.length >= 2 ? `${parts[parts.length - 1]} End` : 'End',
  };
}

// Trails whose live cover is the owner's own upload keep it; our cover file is not published for them.
const ownerCovers = new Set(snapshot.trails.filter((t) => t.cover_image_url && !t.cover_image_url.includes('images.unsplash.com')).map((t) => t.id));

function photosFor(id) {
  return (photos.trails[id] ?? []).filter((p) => !(p.role === 'cover' && ownerCovers.has(id))).map((p) => ({
    file: p.file,
    role: p.role,
    path: `content/${id}/${p.file}`,
    caption: p.caption,
    match: p.match,
    ...(p.place ? { place: p.place, place_qid: p.place_qid } : {}),
    dist_m: p.dist_m,
    author: p.author,
    license: p.license,
    license_url: p.license_url,
    source_url: p.source_url,
    original_url: p.original_url,
    title: p.title,
    width: p.width,
    height: p.height,
    bytes: p.bytes,
    sha1: p.sha1,
  }));
}

// ---------- existing trails ----------

const trailsOut = [];
const pendingElevation = []; // [{ cp, coord }]

for (const t of snapshot.trails) {
  const g = geom[t.id];
  const e = elev[t.id] && !elev[t.id].error ? elev[t.id] : null;
  const synthesised = Number(t.id.slice(-3)) >= 100;
  const storedRoute = geoJsonCoords(t.route);
  const route = g.route;
  const full = g.full ?? g.route;
  const changed = [];
  const baseline = {};
  const provenance = {};
  const flags = [...g.flags];
  const measured = g.measurable && !!e;
  const ds = {
    id: t.id, is_new: false,
    osm_relation_id: null, osm_relation_ids: relationIdsFor(t.id),
    name_en: t.name_en, name_ka: t.name_ka ?? null,
    description_en: t.description_en ?? null, description_ka: t.description_ka ?? null,
    difficulty: t.difficulty, region: t.region,
    distance_km: Number(t.distance_km), elevation_gain_m: t.elevation_gain_m, estimated_hours: Number(t.estimated_hours),
    start_address: t.start_address ?? null,
    route: storedRoute.map(roundCoord), start_point: geoJsonCoords(t.start_point), end_point: geoJsonCoords(t.end_point),
  };
  ds.osm_relation_id = ds.osm_relation_ids.length === 1 ? ds.osm_relation_ids[0] : null;
  const change = (field, value, source, note) => {
    const before = field === 'route' ? routeSignature(storedRoute) : ds[field] ?? null;
    ds[field] = value;
    if (!changed.includes(field)) changed.push(field);
    baseline[field] = before;
    provenance[field] = { source, note };
  };
  const keep = (field, note) => {
    provenance[field] = { source: 'kept', note };
  };

  // geometry
  if (g.decision === 'rebuilt') {
    change('route', route, 'osm', g.reason);
    change('start_point', route[0], 'osm', 'first point of the rebuilt route');
    change('end_point', route[route.length - 1], 'osm', 'last point of the rebuilt route');
  } else {
    if (g.reversed) change('route', route, 'measured', 'same line, reversed to run in the direction of the trail name');
    else keep('route', g.reason);
    if (haversineM(ds.start_point, route[0]) > 1) change('start_point', route[0], 'measured', 'first point of the route');
    if (haversineM(ds.end_point, route[route.length - 1]) > 1) change('end_point', route[route.length - 1], 'measured', 'last point of the route');
  }

  // distance
  const old = { distance_km: ds.distance_km, elevation_gain_m: ds.elevation_gain_m, estimated_hours: ds.estimated_hours, difficulty: ds.difficulty, region: ds.region, name_en: ds.name_en };
  if (g.measurable) {
    const km = r1(g.final.length_km);
    if (Math.abs(km - ds.distance_km) / ds.distance_km > 0.1) change('distance_km', km, 'measured', `length of the route: ${km} km`);
    else keep('distance_km', `within 10% of the measured ${km} km`);
  } else keep('distance_km', 'route not measurable (see flags)');

  // ascent
  const synthetic = ds.elevation_gain_m === Math.round(old.distance_km * 60) || ds.elevation_gain_m === Math.round(old.distance_km * 40);
  if (measured) {
    const gain = e.ascent_m;
    const off = Math.abs(gain - ds.elevation_gain_m) / Math.max(1, ds.elevation_gain_m);
    if (synthetic || off > 0.25) change('elevation_gain_m', gain, 'dem', `SRTM 30 m profile, ${e.samples} samples every ~${e.spacing_m} m, 10 m hysteresis${synthetic ? '; stored value was the synthetic distance × 60/40' : ''}`);
    else keep('elevation_gain_m', `within 25% of the measured ${gain} m`);
  } else {
    keep('elevation_gain_m', 'not measured');
    if (synthetic) {
      flags.push(`elevation_gain_m (${ds.elevation_gain_m} m) is the synthetic distance × 60/40 and could not be measured`);
      ds._syntheticElevation = true;
    }
  }

  // time
  if (measured && (changed.includes('distance_km') || changed.includes('elevation_gain_m') || synthesised)) {
    const h = roundHours(dinHours(ds.distance_km, ds.elevation_gain_m, e.descent_m));
    if (Math.abs(h - ds.estimated_hours) > 1e-9) change('estimated_hours', h, 'formula', `DIN 33466 for ${ds.distance_km} km, +${ds.elevation_gain_m} m / -${e.descent_m} m`);
    else keep('estimated_hours', 'DIN 33466 gives the same value');
  } else keep('estimated_hours', measured ? 'distance and ascent unchanged' : 'not measured');

  // difficulty
  let effort = null;
  if (measured) {
    const f = difficultyFor(ds.distance_km, ds.elevation_gain_m, e.max_m);
    effort = f.effort;
    if (synthesised) {
      if (f.difficulty !== ds.difficulty) change('difficulty', f.difficulty, 'formula', `effort ${f.effort} (km + ascent/100)${e.max_m > 3000 ? ', +1 level above 3000 m' : ''}`);
      else keep('difficulty', `formula agrees (effort ${f.effort})`);
    } else if (difficultyGap(f.difficulty, ds.difficulty) >= 2) {
      report.difficultyOverrides.push({ id: t.id, name: t.name_en, stored: ds.difficulty, formula: f.difficulty, effort: f.effort });
      change('difficulty', f.difficulty, 'formula', `hand-set "${ds.difficulty}" is two or more levels from the formula (effort ${f.effort})`);
    } else keep('difficulty', `hand-curated; formula says ${f.difficulty} (effort ${f.effort})`);
  } else keep('difficulty', 'not measured');

  // elevation profile for the app's chart, along the published route
  const profile = measured ? elevationProfile(e.profile, lineLengthM(route)) : null;
  if (profile) change('elevation_profile', profile, 'dem', `${profile.length} points from the SRTM samples, smoothed like the ascent`);
  else {
    ds.elevation_profile = null;
    keep('elevation_profile', 'not measured');
  }

  // region
  const reg = regionFor(full);
  if (reg.computed && reg.computed !== ds.region && !(ds.region === 'Tbilisi' && reg.nearTbilisi)) {
    report.regionChanges.push({ id: t.id, name: t.name_en, from: ds.region, to: reg.computed, municipalities: reg.prof.municipalities.slice(0, 3) });
    change('region', reg.computed, 'osm', `start and middle of the route are in ${reg.computed} (${reg.prof.municipalities.slice(0, 2).join(', ')})`);
  } else {
    keep('region', reg.computed ? 'matches the location' : `start ${reg.prof.start ?? '?'}, middle ${reg.prof.mid ?? '?'}`);
    if (!reg.computed && ![reg.prof.start, reg.prof.mid, reg.majority].includes(ds.region)) flags.push(`region "${ds.region}" does not match the route (start ${reg.prof.start}, middle ${reg.prof.mid})`);
  }

  // names
  const tov = textOverrides[t.id] ?? {};
  if (tov.name_en) change('name_en', tov.name_en, 'manual', tov.why ?? 'edited by hand');
  else if (synthesised) {
    const clean = fixEnglishName(ds.name_en);
    if (clean !== ds.name_en) {
      report.nameChanges.push({ id: t.id, from: ds.name_en, to: clean });
      change('name_en', clean, 'osm', 'machine-made OSM name tidied (separators, typos)');
    }
  }
  if (tov.name_ka) {
    change('name_ka', tov.name_ka, 'manual', tov.why ?? 'written by hand');
    georgianAuthored.push({ id: t.id, field: 'name_ka', text: tov.name_ka, how: 'written by hand' });
  } else if (!ds.name_ka) {
    const rel = relations[ds.osm_relation_ids[0]];
    const relKa = rel ? rel.tags['name:ka'] ?? (hasGeorgian(rel.tags.name) ? rel.tags.name : null) : null;
    const composed = relKa ? null : composeKa(ds.name_en, full);
    if (relKa) change('name_ka', cleanName(relKa).name, 'osm', `name:ka of OSM relation ${rel.id}`);
    else if (composed) {
      change('name_ka', composed.ka, 'osm', `joined from OSM toponyms: ${composed.used.join('; ')}`);
      georgianAuthored.push({ id: t.id, field: 'name_ka', text: composed.ka, how: `joined from OSM name:ka of ${composed.used.join('; ')}` });
    } else flags.push('no Georgian name: none in OSM');
  }

  // descriptions
  const loop = haversineM(route[0], route[route.length - 1]) < 200;
  const ends = endLabels(ds.name_en, route);
  const statsForText = measured ? e : null;
  const desc = describeEn({ km: ds.distance_km, stats: statsForText, from: ends.from, to: ends.to, loop, passes: passesAlong(full, [ends.from, ends.to]) });
  const stubEn = !ds.description_en || STUB_EN.test(ds.description_en) || ds.description_en.trim() === ds.name_en.trim() || ds.description_en.trim().length < 45 || !!tov.regenerate?.includes('description_en');
  if (tov.description_en) change('description_en', tov.description_en, 'manual', tov.why ?? 'written by hand');
  else if (stubEn && g.measurable) change('description_en', desc, 'osm', 'generated from the route, OSM features and the elevation profile (replaces a stub)');
  else keep('description_en', stubEn ? 'stub kept: route not measurable' : 'written by hand');
  const stubKa = !ds.description_ka || STUB_KA.test(ds.description_ka) || !!tov.regenerate?.includes('description_ka');
  if (stubKa && g.measurable) {
    const ka = describeKa({ km: ds.distance_km, stats: statsForText });
    change('description_ka', ka, 'formula', 'template text from the measured values (replaces a stub)');
    georgianAuthored.push({ id: t.id, field: 'description_ka', text: ka, how: 'template' });
  } else keep('description_ka', stubKa ? 'stub kept: route not measurable' : 'written by hand');

  // checkpoints
  const cum = cumulativeM(route);
  const routeLen = cum[cum.length - 1];
  const oldLen = lineLengthM(storedRoute);
  const sorted = [...t.checkpoints].sort((a, b) => a.sort_order - b.sort_order);
  const cps = [];
  sorted.forEach((c, idx) => {
    const oldCoord = geoJsonCoords(c.coordinates);
    const first = idx === 0;
    const last = idx === sorted.length - 1;
    const atOldStart = haversineM(oldCoord, storedRoute[0]) < 50;
    const rawFrac = oldLen > 0 ? nearestOnLine(oldCoord, storedRoute, cumulativeM(storedRoute)).alongM / oldLen : 0;
    const oldFrac = g.reversed ? 1 - rawFrac : rawFrac;
    const cp = {
      id: c.id, name_en: c.name_en, name_ka: c.name_ka ?? null, description_en: c.description_en ?? null, description_ka: c.description_ka ?? null,
      type: c.type, coordinates: oldCoord, elevation_m: c.elevation_m ?? null, sort_order: c.sort_order, is_checkable: c.is_checkable ?? false,
      changed: [], baseline: {}, provenance: {}, flags: [], _along: null,
    };
    const set = (field, value, source, note) => {
      if (!cp.changed.includes(field)) {
        cp.changed.push(field);
        cp.baseline[field] = cp[field] ?? null;
      }
      cp[field] = value;
      cp.provenance[field] = { source, note };
    };
    let placed = false;
    // auto-generated "X Start" / "Y End" of the imported OSM trails
    if (synthesised && (first || last) && /\b(Start|End)$/.test(c.name_en)) {
      const name = first ? ends.startName : ends.endName;
      if (name !== c.name_en) set('name_en', name, 'osm', 'label rebuilt from the trail name (old one was truncated or repeated the trail name)');
      const target = first ? route[0] : route[route.length - 1];
      if (haversineM(target, oldCoord) > 1) set('coordinates', target, 'measured', first ? 'start of the route' : 'end of the route (was placed at 95% of the old point list)');
      placed = true;
    }
    // a named real place: find it near the route
    if (!placed && hasProperName(c.name_en)) {
      const kinds = KINDS_FOR_TYPE[c.type] ?? KINDS_FOR_TYPE.landmark;
      const hits = features.nearLine(full, 1500, kinds).filter((n) => labelMatches(c.name_en, n.f));
      if (hits.length) {
        const targetAlong = oldFrac * routeLen;
        hits.sort((a, b) => kinds.indexOf(a.f.kind) - kinds.indexOf(b.f.kind) || a.distM - b.distM || Math.abs(a.alongM - targetAlong) - Math.abs(b.alongM - targetAlong));
        const h = hits[0];
        let target = nearestOnLine(h.probe, route).point;
        let note = `${featureLabel(h.f)} (${h.f.osm}) is ${Math.round(h.distM)} m from the route`;
        if ((first && atOldStart) || (first && haversineM(h.probe, route[0]) < 1500)) {
          if (haversineM(h.probe, route[0]) < 1500) {
            target = route[0];
            note += '; start of the route';
          }
        }
        if (last && haversineM(h.probe, route[route.length - 1]) < 300) target = route[route.length - 1];
        target = roundCoord(target);
        const moved = haversineM(target, oldCoord);
        if (moved > 1) set('coordinates', target, 'osm', `moved ${Math.round(moved)} m: ${note}`);
        else cp.provenance.coordinates = { source: 'osm', note: `confirmed: ${note}` };
        const ka = georgianName(h.f);
        if (!cp.name_ka && ka) set('name_ka', ka.trim(), 'osm', `name:ka of ${h.f.osm}`);
        cp.confirmed = { by: h.f.osm, label: featureLabel(h.f), dist_m: Math.round(h.distM), moved_m: Math.round(moved) };
        placed = true;
      }
    }
    // a facility hikers may rely on: needs a mapped feature of that kind on the route
    const facilityKind = FACILITY_KIND[c.type];
    if (facilityKind && !placed) {
      const targetAlong = oldFrac * routeLen;
      const hits = features.nearLine(full, 150, [facilityKind]).sort((a, b) => Math.abs(a.alongM - targetAlong) - Math.abs(b.alongM - targetAlong));
      // a named facility that was not found by name only counts if a mapped one is right where it was
      if (hits.length && (!hasProperName(c.name_en) || haversineM(hits[0].probe, oldCoord) <= 500)) {
        const h = hits[0];
        const target = roundCoord(h.probe);
        const moved = haversineM(target, oldCoord);
        if (moved > 1) set('coordinates', target, 'osm', `moved ${Math.round(moved)} m to the mapped ${h.f.kind} ${h.f.osm}${featureLabel(h.f) ? ` "${featureLabel(h.f)}"` : ''}`);
        cp.confirmed = { by: h.f.osm, label: featureLabel(h.f), dist_m: Math.round(h.distM), moved_m: Math.round(moved), several: hits.length > 1 };
        if (hits.length > 1) cp.flags.push(`${hits.length} mapped ${h.f.kind}s on the route; used the one nearest the original position`);
        placed = true;
      } else {
        if (cp.is_checkable) set('is_checkable', false, 'osm', `no mapped ${facilityKind} within 150 m of the route`);
        cp.flags.push(`UNCONFIRMED FACILITY: no ${c.type.replace('_', ' ')} is mapped in OSM on this route — hikers must not rely on it`);
        cp.unconfirmedFacility = true;
      }
    }
    // the first checkpoint of a rebuilt route follows the new start
    if (!placed && first && atOldStart && (g.decision === 'rebuilt' || g.reversed)) {
      const moved = haversineM(route[0], oldCoord);
      if (moved > 1) set('coordinates', route[0], 'measured', g.reversed ? 'start of the route (the route now runs in the direction of the trail name)' : 'start of the rebuilt route');
      placed = true;
    }
    if (!placed && !cp.unconfirmedFacility) cp.flags.push('position not confirmed (placed by the original import at a fixed fraction of the route)');
    const off = nearestOnLine(cp.coordinates, route).distM;
    if (!placed && off > 200) {
      if (cp.is_checkable) set('is_checkable', false, 'measured', `${Math.round(off)} m from the route`);
      cp.flags.push(`${Math.round(off)} m from the route and not confirmed — not checkable`);
    }
    cp._along = nearestOnLine(cp.coordinates, route, cum).alongM;
    pendingElevation.push(cp);
    cps.push(cp);
  });
  // order along the route (first stays first, last stays last)
  const order = [...cps].sort((a, b) => (a === cps[0] ? -1 : b === cps[0] ? 1 : a === cps[cps.length - 1] ? 1 : b === cps[cps.length - 1] ? -1 : a._along - b._along));
  order.forEach((cp, i) => {
    if (cp.sort_order !== i) {
      if (!cp.changed.includes('sort_order')) {
        cp.changed.push('sort_order');
        cp.baseline.sort_order = cp.sort_order;
      }
      cp.sort_order = i;
      cp.provenance.sort_order = { source: 'measured', note: 'order along the route' };
    }
  });

  ds.checkpoints = order;
  ds.photos = photosFor(t.id);
  ds.stats = measured
    ? { ascent_m: e.ascent_m, descent_m: e.descent_m, min_m: e.min_m, max_m: e.max_m, effort, dem_samples: e.samples, dem_spacing_m: e.spacing_m, shape: g.shape }
    : { shape: g.shape };
  ds.changed = changed;
  ds.baseline = baseline;
  ds.provenance = provenance;
  ds.flags = flags;
  trailsOut.push(ds);
  report.existing.push({ id: t.id, name_old: old.name_en, name: ds.name_en, old, new: { distance_km: ds.distance_km, elevation_gain_m: ds.elevation_gain_m, estimated_hours: ds.estimated_hours, difficulty: ds.difficulty, region: ds.region }, decision: g.decision, measurable: g.measurable, manual_review: g.manual_review, flags, stats: ds.stats, changed });
}

// ---------- new trails ----------

const PRIORITY = { pass: 1, peak: 2, lake: 3, waterfall: 4, hut: 5, camp: 6, water: 7, viewpoint: 8, church: 9, tower: 10, ruins: 11, glacier: 12, place: 13 };
for (const a of newGeom.accepted) {
  const e = elev[a.id];
  if (!e || e.error) {
    report.rejected.push({ relation: a.osm_relation_id, name: a.name_en, reason: `no elevation data: ${e?.error ?? 'not sampled'}` });
    continue;
  }
  const tov = textOverrides[a.id] ?? {};
  if (tov.reject) {
    report.rejected.push({ relation: a.osm_relation_id, name: a.name_en, reason: `rejected by hand: ${tov.reject}` });
    continue;
  }
  const route = a.route;
  const full = a.full;
  const km = r1(a.length_km);
  const flags = [];
  const reg = regionFor(full);
  const region = reg.computed ?? reg.prof.start ?? reg.majority;
  if (!region) {
    report.rejected.push({ relation: a.osm_relation_id, name: a.name_en, reason: 'no region (outside Georgian-controlled territory?)' });
    continue;
  }
  if (!reg.computed) flags.push(`region taken from the start (start ${reg.prof.start}, middle ${reg.prof.mid})`);
  const hours = roundHours(dinHours(km, e.ascent_m, e.descent_m));
  const diff = difficultyFor(km, e.ascent_m, e.max_m);
  const nameEn = tov.name_en ?? a.name_en;
  let nameKa = tov.name_ka ?? (a.name_ka ? (a.name_source === 'generated' ? a.name_ka : cleanName(a.name_ka).name) : null);
  if (a.name_source === 'generated' && nameKa && !tov.name_ka) georgianAuthored.push({ id: a.id, field: 'name_ka', text: nameKa, how: `joined from the OSM names of the features at its ends: ${a.name_from.join('; ')}` });
  if (tov.name_ka) georgianAuthored.push({ id: a.id, field: 'name_ka', text: tov.name_ka, how: 'written by hand' });
  if (!nameKa) {
    const composed = composeKa(nameEn, full);
    if (composed) {
      nameKa = composed.ka;
      georgianAuthored.push({ id: a.id, field: 'name_ka', text: composed.ka, how: `joined from OSM name:ka of ${composed.used.join('; ')}` });
    }
  }
  if (a.name_en_transliterated) flags.push(`English name transliterated from the Georgian OSM name "${a.name_ka}"`);
  const loop = haversineM(route[0], route[route.length - 1]) < 200;
  const ends = endLabels(nameEn, route);
  const passes = passesAlong(full, [ends.from, ends.to]);
  const description_en = tov.description_en ?? describeEn({ km, stats: e, from: ends.from, to: ends.to, loop, passes });
  const description_ka = describeKa({ km, stats: e });
  georgianAuthored.push({ id: a.id, field: 'description_ka', text: description_ka, how: 'template' });

  // checkpoints: start, end, named features on or near the route
  const cum = cumulativeM(route);
  const cps = [];
  const mk = (key, name, nameKaCp, type, coord, along, note) => ({
    id: checkpointId(a.id, key), name_en: name, name_ka: nameKaCp ?? null, description_en: null, description_ka: null,
    type, coordinates: roundCoord(coord), elevation_m: null, sort_order: 0, is_checkable: true,
    changed: [], baseline: {}, provenance: { coordinates: { source: 'osm', note } }, flags: [], _along: along,
  });
  cps.push(mk('start', ends.startName, null, 'landmark', route[0], 0, 'start of the route'));
  const picked = [];
  const endNames = [ends.from, ends.to, ...endParts(nameEn)].filter(Boolean);
  for (const n of features.nearLine(full, 150, Object.keys(PRIORITY))) {
    const f = n.f;
    const label = englishLabel(f);
    if (!label) continue;
    if (f.kind === 'place' && (!/^(village|hamlet|town)$/.test(f.tags?.place ?? '') || n.distM > 100)) continue;
    if (f.kind === 'peak' && n.distM > 100) continue;
    if (f.kind === 'water' && !/spring|source|წყარო/i.test(`${f.tags?.natural ?? ''} ${label}`) && f.tags?.amenity !== 'drinking_water') continue;
    const along = nearestOnLine(n.probe, route, cum).alongM;
    // Start and End already mark the ends; skip what coincides with them or repeats their names
    if (along < 200 || along > cum[cum.length - 1] - 200) continue;
    if (f.kind === 'place' && (along < 300 || along > cum[cum.length - 1] - 300)) continue;
    if (endNames.some((x) => x.toLowerCase() === label.toLowerCase() || sameToponym(x, label))) continue;
    picked.push({ n, f, label, along });
  }
  const chosen = [];
  for (const p of picked.sort((x, y) => PRIORITY[x.f.kind] - PRIORITY[y.f.kind] || x.n.distM - y.n.distM)) {
    if (chosen.some((c) => c.label.toLowerCase() === p.label.toLowerCase() || Math.abs(c.along - p.along) < 300)) continue;
    chosen.push(p);
    if (chosen.length >= 8) break;
  }
  for (const p of chosen.sort((x, y) => x.along - y.along)) {
    cps.push(mk(`osm:${p.f.osm}`, p.label, georgianName(p.f), TYPE_FOR_KIND[p.f.kind] ?? 'landmark', p.n.probe, p.along, `${p.f.osm}, ${Math.round(p.n.distM)} m from the route`));
  }
  cps.push(mk('end', ends.endName, null, 'landmark', route[route.length - 1], cum[cum.length - 1], 'end of the route'));
  cps.forEach((c, i) => {
    c.sort_order = i;
  });
  pendingElevation.push(...cps);

  const ds = {
    id: a.id, is_new: true, osm_relation_id: a.osm_relation_id, osm_relation_ids: [a.osm_relation_id],
    name_en: nameEn, name_ka: nameKa, description_en, description_ka,
    difficulty: diff.difficulty, region, distance_km: km, elevation_gain_m: e.ascent_m, estimated_hours: hours, start_address: null,
    elevation_profile: elevationProfile(e.profile, lineLengthM(route)),
    route, start_point: route[0], end_point: route[route.length - 1],
    checkpoints: cps, photos: photosFor(a.id),
    stats: { ascent_m: e.ascent_m, descent_m: e.descent_m, min_m: e.min_m, max_m: e.max_m, effort: diff.effort, dem_samples: e.samples, dem_spacing_m: e.spacing_m, shape: a.shape },
    changed: ['name_en', 'name_ka', 'description_en', 'description_ka', 'difficulty', 'region', 'distance_km', 'elevation_gain_m', 'estimated_hours', 'start_address', 'elevation_profile', 'route', 'start_point', 'end_point'],
    // the 85 trails published first had no elevation_profile column yet: NULL is the value to replace
    baseline: { elevation_profile: null },
    provenance: {
      route: { source: 'osm', note: `OSM relation ${a.osm_relation_id} (${a.stitch.method}${a.stitch.max_gap_m ? `, gaps up to ${a.stitch.max_gap_m} m` : ''}), Douglas–Peucker ${a.simplify_tolerance_m} m` },
      name_en: a.name_source === 'generated'
        ? { source: 'osm', name_source: 'generated', note: `the relation has no name; named after the OSM features at its ends: ${a.name_from.join('; ')}` }
        : { source: 'osm', note: a.name_en_transliterated ? 'transliterated from name:ka' : 'OSM name' },
      name_ka: { source: nameKa ? 'osm' : 'kept', note: nameKa ? (a.name_source === 'generated' ? 'name:ka of the same features' : 'OSM name:ka / toponyms') : 'none in OSM', ...(a.name_source === 'generated' ? { name_source: 'generated' } : {}) },
      distance_km: { source: 'measured', note: 'length of the OSM line' },
      elevation_gain_m: { source: 'dem', note: `SRTM 30 m, ${e.samples} samples every ~${e.spacing_m} m, 10 m hysteresis` },
      estimated_hours: { source: 'formula', note: 'DIN 33466' },
      elevation_profile: { source: 'dem', note: 'SRTM samples along the route, smoothed like the ascent' },
      difficulty: { source: 'formula', note: `effort ${diff.effort}` },
      region: { source: 'osm', note: `municipality boundaries: ${reg.prof.municipalities.slice(0, 2).join(', ')}` },
      description_en: { source: 'osm', note: 'generated from the route, OSM features and the elevation profile' },
      description_ka: { source: 'formula', note: 'template' },
    },
    flags: [
      ...flags,
      ...(a.unmarked ? ['OSM says the route has no trail markers'] : []),
      ...(a.name_source === 'generated' ? ['name generated from the OSM features at its ends — please review'] : []),
      ...(a.recovered === 'broken' ? [`main line picked from a branching or broken relation (${a.stitch.method}; ${a.stitch.dropped_m} m of side or parallel ways left out${a.stitch.max_gap_m ? `; a ${a.stitch.max_gap_m} m gap joined` : ''})`] : []),
      ...(a.occupation_line_km != null && a.occupation_line_km < 5 ? [`passes within ${a.occupation_line_km} km of the occupation line`] : []),
      ...(a.stitch.dropped_m ? [`side spurs of the relation not included: ${a.stitch.dropped_m} m`] : []),
      ...(a.tags.roundtrip === 'yes' && a.shape === 'line' ? ['OSM marks it as a round trip; the line is one way (walk back the same way)'] : []),
    ],
    occupation_line_km: a.occupation_line_km,
  };
  trailsOut.push(ds);
  report.fresh.push({ recovered: a.recovered ?? null, name_source: a.name_source ?? 'osm', name_from: a.name_from ?? null, dropped_m: a.stitch.dropped_m, method: a.stitch.method, id: a.id, relation: a.osm_relation_id, name: nameEn, name_ka: nameKa, region, distance_km: km, ascent: e.ascent_m, max_m: e.max_m, hours, difficulty: diff.difficulty, checkpoints: cps.length, flags: ds.flags });
}

// ---------- checkpoint elevations ----------
const cpElev = await elevations(pendingElevation.map((c) => c.coordinates));
pendingElevation.forEach((cp, i) => {
  const v = cpElev[i];
  if (typeof v !== 'number') {
    cp.flags.push('no elevation in SRTM/ASTER at this point');
    return;
  }
  const m = Math.round(v);
  if (cp.elevation_m !== m) {
    if (!cp.changed.includes('elevation_m') && cp.baseline) {
      cp.changed.push('elevation_m');
      cp.baseline.elevation_m = cp.elevation_m ?? null;
    }
    cp.elevation_m = m;
    cp.provenance.elevation_m = { source: 'dem', note: 'SRTM 30 m at the checkpoint' };
  }
});
// ---------- review flags (trails.review_flags, migration 052) ----------
// Short stable codes for what an admin should look at first; meanings in scripts/README.md.
const NEAR_BORDER_M = 3000;
const OVERLAP_SHARE = 0.8;
const AREA_PHOTO_M = 5000;
const ESTIMATED_CHECKPOINT = /^position not confirmed|not confirmed — not checkable/;
const authoredKa = new Set(georgianAuthored.map((x) => x.id));
const freshById = new Map(newGeom.accepted.map((a) => [a.id, a]));
const lineOf = trailsOut.map((t) => ({ t, box: bbox(t.route), index: new LineIndex(t.route) }));
// pairs with the same name, or where most of one line runs within 100 m of the other (a duplicate, a variant,
// or a stage of a longer trek); both trails of a pair are flagged
report.overlaps = [];
for (let i = 0; i < lineOf.length; i++) {
  for (let j = i + 1; j < lineOf.length; j++) {
    const a = lineOf[i];
    const b = lineOf[j];
    const sameName = a.t.name_en.toLowerCase() === b.t.name_en.toLowerCase();
    if (!sameName && !bboxesIntersect(a.box, b.box, 0.003)) continue;
    const ab = overlapShare(a.t.route, b.index, 100, 100);
    const ba = overlapShare(b.t.route, a.index, 100, 100);
    if (sameName || Math.max(ab, ba) >= OVERLAP_SHARE) {
      report.overlaps.push({ a: a.t.id, a_name: a.t.name_en, a_new: a.t.is_new, b: b.t.id, b_name: b.t.name_en, b_new: b.t.is_new, ab: Math.round(ab * 100) / 100, ba: Math.round(ba * 100) / 100, same_name: sameName });
    }
  }
}
for (const t of trailsOut) {
  const codes = new Set();
  if (!t.is_new) {
    const g = geom[t.id];
    if (g.manual_review) codes.add('manual_review');
    if (g.decision === 'rebuilt') codes.add('rebuilt');
    if (g.reversed) codes.add('reversed');
    if (t._syntheticElevation) codes.add('synthetic_elevation');
  } else {
    const a = freshById.get(t.id);
    if (a.name_source === 'generated') codes.add('generated_name');
    if (a.recovered === 'broken') codes.add('main_line');
  }
  if (authoredKa.has(t.id)) codes.add('machine_georgian');
  const samples = sampleAlong(t.route, 250, 800).map((s) => s.p);
  if (distanceToOccupiedM(samples, NEAR_BORDER_M) < NEAR_BORDER_M || distanceToBorderM(samples, NEAR_BORDER_M) < NEAR_BORDER_M) codes.add('near_border');
  if (report.overlaps.some((o) => o.a === t.id || o.b === t.id)) codes.add('overlap');
  if (t.checkpoints.some((c) => c.flags.some((f) => ESTIMATED_CHECKPOINT.test(f)))) codes.add('estimated_checkpoints');
  if (t.checkpoints.some((c) => c.unconfirmedFacility)) codes.add('unconfirmed_facility');
  // an owner-uploaded cover stays, so such a trail is neither without a photo nor covered from afar
  const cover = t.photos.find((p) => p.role === 'cover');
  if (!t.photos.length && !ownerCovers.has(t.id)) codes.add('no_photo');
  if (cover && !(cover.dist_m != null && cover.dist_m <= AREA_PHOTO_M)) codes.add('area_photo');
  delete t._syntheticElevation;
  t.review_flags = REVIEW_FLAG_CODES.filter((c) => codes.has(c));
  // the column is '{}' everywhere today (new in migration 052): the empty array is the baseline
  if (t.is_new || t.review_flags.length) {
    t.changed.push('review_flags');
    t.baseline.review_flags = [];
  }
  t.provenance.review_flags = { source: 'pipeline', note: 'reasons to look first, derived from the checks recorded in flags/provenance; codes in scripts/README.md' };
}

for (const t of trailsOut) {
  for (const cp of t.checkpoints) {
    if (t.is_new) {
      cp.changed = [];
      cp.baseline = {};
    }
    report.checkpoints.push({ trail: t.id, trail_name: t.name_en, id: cp.id, name: cp.name_en, type: cp.type, is_new: t.is_new, changed: cp.changed, confirmed: cp.confirmed ?? null, flags: cp.flags, is_checkable: cp.is_checkable, unconfirmed_facility: !!cp.unconfirmedFacility, provenance: cp.provenance });
    delete cp._along;
    delete cp.confirmed;
    delete cp.unconfirmedFacility;
  }
}

// ---------- terrain (12-terrain.mjs), kept while the route it was computed for is unchanged ----------
const terrainWork = readJsonIfExists(path.join(WORK, 'terrain.json'), { trails: {} });
let terrainStale = 0;
for (const t of trailsOut) {
  const e = terrainWork.trails[t.id];
  t.terrain = e && e.route_key === routeKey(t.route) ? e.terrain : null;
  if (t.terrain) t.provenance.terrain = { source: 'osm', note: terrainNote(t.terrain.fetched_at, e.geometry) };
  else if (e) terrainStale++;
}

// ---------- write ----------
const dataset = {
  generated_at: new Date().toISOString(),
  snapshot: path.basename(snapshotPath),
  attribution: 'Routes and features © OpenStreetMap contributors (ODbL). Elevation: SRTM 30 m / ASTER via OpenTopoData. Photos: Wikimedia Commons, see CREDITS.md.',
  counts: {
    trails: trailsOut.length,
    existing: trailsOut.filter((t) => !t.is_new).length,
    new: trailsOut.filter((t) => t.is_new).length,
    checkpoints: trailsOut.reduce((n, t) => n + t.checkpoints.length, 0),
    photos: trailsOut.reduce((n, t) => n + t.photos.length, 0),
    terrain: trailsOut.filter((t) => t.terrain).length,
  },
  trails: trailsOut,
};
writeDataset(dataset);
if (dataset.counts.terrain < trailsOut.length) {
  console.log(`terrain: ${dataset.counts.terrain} of ${trailsOut.length} trails${terrainStale ? ` (${terrainStale} routes changed since)` : ''} — run 12-terrain.mjs`);
}
writeJson(path.join(WORK, 'build-report.json'), { ...report, georgianAuthored, counts: dataset.counts });
console.log(`trails.json: ${dataset.counts.existing} existing + ${dataset.counts.new} new trails, ${dataset.counts.checkpoints} checkpoints, ${dataset.counts.photos} photos`);
const changedCount = trailsOut.filter((t) => !t.is_new && t.changed.length).length;
console.log(`existing trails with changes: ${changedCount}; Georgian strings written: ${georgianAuthored.length}`);
