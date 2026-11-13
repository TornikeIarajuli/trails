// Named OSM features near a route: lookup by name, features passed along the way, place names for ends.
import { LineIndex, PointIndex, bbox, cumulativeM, haversineM, lineLengthM, nearestOnLine } from './geo.mjs';
import { englishName, georgianName, isLatin, latinNames, properTokens, romanizeKa, sameToponym } from './names.mjs';

export const TYPE_FOR_KIND = {
  peak: 'summit', pass: 'pass', viewpoint: 'viewpoint', lake: 'lake', waterfall: 'waterfall', water: 'water_source',
  hut: 'shelter', camp: 'campsite', church: 'church', tower: 'tower', ruins: 'ruins', bridge: 'bridge',
  glacier: 'landmark', place: 'landmark', landmark: 'landmark', cave: 'landmark', info: 'landmark',
};

/** Which OSM feature kinds may confirm a checkpoint of a given type. */
export const KINDS_FOR_TYPE = {
  landmark: ['place', 'landmark', 'ruins', 'church', 'tower', 'bridge', 'glacier', 'lake', 'waterfall', 'viewpoint', 'pass', 'peak', 'cave'],
  viewpoint: ['viewpoint', 'peak', 'landmark', 'place', 'pass', 'glacier'],
  summit: ['peak'],
  pass: ['pass'],
  lake: ['lake'],
  waterfall: ['waterfall'],
  church: ['church', 'ruins'],
  ruins: ['ruins', 'church', 'tower', 'place', 'landmark'],
  tower: ['tower', 'ruins', 'place'],
  shelter: ['hut'],
  campsite: ['camp'],
  water_source: ['water', 'landmark'],
  bridge: ['bridge'],
};

export const FACILITY_KIND = { shelter: 'hut', campsite: 'camp', water_source: 'water' };

export class Features {
  constructor(pois) {
    this.pois = pois;
    this.index = new PointIndex(pois, (p) => p.coord, 0.02);
  }

  /** Features within maxM of the line: [{ f, distM, alongM, onLine }] sorted by position along the line. */
  nearLine(coords, maxM, kinds = null) {
    const lineIndex = new LineIndex(coords);
    const cum = cumulativeM(coords);
    const pad = maxM / 70000 + 0.01;
    const out = [];
    for (const f of this.index.inBbox(bbox(coords), pad)) {
      if (kinds && !kinds.includes(f.kind)) continue;
      let probe = f.coord;
      if (f.outline) probe = nearestOutlinePoint(f.outline, coords) ?? f.coord;
      if (lineIndex.distanceWithin(probe, maxM) === Infinity) continue;
      const n = nearestOnLine(probe, coords, cum);
      out.push({ f, distM: n.distM, alongM: n.alongM, onLine: n.point, probe });
    }
    return out.sort((a, b) => a.alongM - b.alongM);
  }
}

/** Point of an area outline closest to a line (the lake shore nearest the trail). */
export function nearestOutlinePoint(outline, coords) {
  let best = null;
  let bestD = Infinity;
  const step = Math.max(1, Math.floor(coords.length / 150));
  for (const ring of outline) {
    for (const v of ring) {
      for (let i = 0; i < coords.length; i += step) {
        const d = Math.abs(v[0] - coords[i][0]) * 0.74 + Math.abs(v[1] - coords[i][1]);
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      }
    }
  }
  return best;
}

/** Does a checkpoint label name this feature? Every proper word of the label must match. */
export function labelMatches(label, f) {
  const tokens = properTokens(label).filter((t) => /^[A-Za-z'’]+$/.test(t));
  if (!tokens.length) return false;
  return latinNames(f).some((name) => {
    const words = name.split(/[^A-Za-z'’]+/).filter((w) => w.length >= 3);
    return tokens.every((t) => words.some((w) => sameToponym(t, w)) || sameToponym(t, name));
  });
}

export function hasProperName(label) {
  return properTokens(label).some((t) => /^[A-Za-z'’]+$/.test(t));
}

/** Nearest named settlement to a point (within maxM), as { en, ka, distM, f }. */
export function placeNear(features, p, maxM = 1500) {
  let best = null;
  for (const f of features.index.inBbox([p[0], p[1], p[0], p[1]], maxM / 70000 + 0.01)) {
    if (f.kind !== 'place' || !/^(city|town|village|hamlet|suburb|neighbourhood|isolated_dwelling)$/.test(f.tags?.place ?? '')) continue;
    const d = haversineM(p, f.coord);
    if (d <= maxM && (!best || d < best.distM)) best = { distM: d, f };
  }
  if (!best) return null;
  return { en: englishName(best.f), ka: georgianName(best.f), distM: Math.round(best.distM), f: best.f };
}

export const featureLabel = (f) => englishName(f);

/**
 * Name to show in English text: an English or Latin OSM name; for settlements also the romanised
 * Georgian name. Null for features known only by a Georgian descriptive name or a survey code.
 */
export function englishLabel(f) {
  const latin = f.name_en ?? (isLatin(f.name) ? f.name : null) ?? (isLatin(f.tags?.int_name) ? f.tags.int_name : null);
  let label = latin ?? (f.kind === 'place' && georgianName(f) ? romanizeKa(georgianName(f)) : null);
  if (!label) return null;
  label = label.trim();
  if (/\d{3,}|[,;]|\(\s|\s\)|\([^)]*\d[^)]*\)|\.[a-z]/.test(label) || label.length > 60) return null;
  return label;
}

/** Start and end labels of a trail name: "A - B" gives [A, B]; a trailing "(A - B)" wins; parentheses and a trailing "Trail" are dropped. */
export function endParts(name) {
  const inner = String(name ?? '').match(/\(([^()]+ - [^()]+)\)\s*$/);
  const base = inner ? inner[1] : String(name ?? '').replace(/\([^()]*\)/g, ' ');
  const parts = nameParts(base).map((p) => p.replace(/\s+(trail|path|route|track)$/i, '').replace(/[()]/g, '').trim()).filter(Boolean);
  return parts.length >= 2 ? [parts[0], parts[parts.length - 1]] : [];
}

const DESTINATION_KINDS = [
  [/\bpass\b|ugheltekhili/i, ['pass']],
  [/\blakes?\b|\btba\b/i, ['lake']],
  [/\bglacier\b/i, ['glacier']],
  [/\bwaterfalls?\b/i, ['waterfall']],
  [/\b(summit|peak|mount|mountain|mta)\b/i, ['peak']],
  [/\b(fortress|castle|tower|ruins)\b/i, ['ruins', 'tower']],
  [/\b(church|monastery|cross)\b/i, ['church', 'landmark']],
];

/** For a one-part name such as "Nakaicho Pass Trail": the walk should end at the named destination. */
export function destinationVote(features, line, name) {
  if (haversineM(line[0], line[line.length - 1]) < 300) return { reverse: false, score: 0, why: ['loop'] };
  const kinds = DESTINATION_KINDS.find(([re]) => re.test(name))?.[1];
  if (!kinds) return { reverse: false, score: 0, why: [] };
  const hits = features.nearLine(line, 1500, kinds).filter((n) => labelMatches(name, n.f)).sort((a, b) => a.distM - b.distM);
  if (!hits.length) return { reverse: false, score: 0, why: [] };
  const p = hits[0].probe;
  const ds = haversineM(p, line[0]);
  const de = haversineM(p, line[line.length - 1]);
  if (Math.abs(ds - de) < Math.min(500, 0.3 * lineLengthM(line))) return { reverse: false, score: 0, why: [] };
  return { reverse: ds < de, score: ds < de ? -1 : 1, why: [`destination ${englishName(hits[0].f)} is near the ${ds < de ? 'start' : 'end'}`] };
}

/** "A - B", "A to B", "A => B", "A–B" → ["A", "B"]. */
export const nameParts = (name) =>
  String(name ?? '')
    .split(/\s+(?:-|–|—|=>|->|to)\s+|–|—/i)
    .map((p) => p.trim())
    .filter(Boolean);

/**
 * Votes on the direction of a line: a start label found near the line's end (or an end label near
 * its start) votes for reversing. Labels are matched against named OSM features within 3 km.
 */
export function directionVotes(features, line, startLabels, endLabels) {
  if (haversineM(line[0], line[line.length - 1]) < 300) return { reverse: false, score: 0, why: ['loop'] };
  const near = features.nearLine(line, 3000);
  let score = 0;
  const why = [];
  for (const [labels, sign] of [[startLabels, 1], [endLabels, -1]]) {
    for (const label of labels.filter(Boolean)) {
      // a settlement of that name beats a hut or viewpoint named after it
      const hits = near.filter((n) => labelMatches(label, n.f)).sort((a, b) => (a.f.kind === 'place' ? 0 : 1) - (b.f.kind === 'place' ? 0 : 1) || a.distM - b.distM);
      if (!hits.length) continue;
      const p = hits[0].probe;
      const ds = haversineM(p, line[0]);
      const de = haversineM(p, line[line.length - 1]);
      if (Math.abs(ds - de) < Math.min(500, 0.3 * lineLengthM(line))) continue;
      score += (ds < de ? 1 : -1) * sign;
      why.push(`${label} is near the ${ds < de ? 'start' : 'end'}`);
    }
  }
  return { reverse: score < 0, score, why };
}
