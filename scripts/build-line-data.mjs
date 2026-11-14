#!/usr/bin/env node
// Builds mobile/assets/data/border-lines.json: the lines the hike screen warns about, bundled
// in the app so the warning works without signal.
//
//   - the occupation line: the outlines of Abkhazia and the Tskhinvali region (South Ossetia)
//   - the state border: the outline of Georgia
//
// Input: content/work/osm-admin.json, written by scripts/content/02-osm-fetch.mjs from
// OpenStreetMap (© OpenStreetMap contributors, ODbL). Rings are simplified (Douglas-Peucker,
// a few metres, far below the warning distances) and stored as integer deltas of 1e-5 degree
// (about 1 m), which keeps the file small.
//
// Run from the repository root: node scripts/build-line-data.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '..');
const INPUT = path.join(REPO, 'content', 'work', 'osm-admin.json');
const OUTPUT = path.join(REPO, 'mobile', 'assets', 'data', 'border-lines.json');

// Simplification tolerance (m). The app warns from 300 m away, so a few metres is invisible.
const TOLERANCE_OCCUPIED_M = 8;
const TOLERANCE_BORDER_M = 15;
const SCALE = 1e5;

// How the app names each area: Georgia's own term first
const OCCUPIED_NAMES = {
  'relation/1152720': { name_en: 'Abkhazia', name_ka: 'აფხაზეთი' },
  'relation/1152717': { name_en: 'Tskhinvali region', name_ka: 'ცხინვალის რეგიონი' },
};

/** [lng, lat] → local metres around a reference latitude (good enough over a few hundred km). */
function projector(refLat) {
  const kx = 111320 * Math.cos((refLat * Math.PI) / 180);
  const ky = 110540;
  return ([lng, lat]) => [lng * kx, lat * ky];
}

function perpendicularM(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas-Peucker on projected points; returns the kept indices (iterative, no recursion limit). */
function simplify(points, toleranceM) {
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxD = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = perpendicularM(points[i], points[first], points[last]);
      if (d > maxD) {
        maxD = d;
        index = i;
      }
    }
    if (maxD > toleranceM && index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return keep;
}

function simplifyRing(ring, toleranceM) {
  const refLat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const project = projector(refLat);
  const projected = ring.map(project);
  const keep = simplify(projected, toleranceM);
  return ring.filter((_, i) => keep[i]);
}

/** [[lng, lat], …] → [lng0, lat0, dLng1, dLat1, …] in 1e-5 degree steps. */
function encode(ring) {
  const out = [];
  let px = 0;
  let py = 0;
  for (const [lng, lat] of ring) {
    const x = Math.round(lng * SCALE);
    const y = Math.round(lat * SCALE);
    out.push(x - px, y - py);
    px = x;
    py = y;
  }
  return out;
}

const admin = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

const occupied = admin.occupied.map((area) => {
  const names = OCCUPIED_NAMES[area.osm] ?? { name_en: area.name_en ?? area.name, name_ka: area.name_ka ?? null };
  const rings = area.rings.map((ring) => simplifyRing(ring, TOLERANCE_OCCUPIED_M));
  console.log(`${names.name_en}: ${area.rings.reduce((n, r) => n + r.length, 0)} → ${rings.reduce((n, r) => n + r.length, 0)} points`);
  return { ...names, osm: area.osm, rings: rings.map(encode) };
});

const borderRings = admin.country.rings.map((ring) => simplifyRing(ring, TOLERANCE_BORDER_M));
console.log(`Georgia: ${admin.country.rings.reduce((n, r) => n + r.length, 0)} → ${borderRings.reduce((n, r) => n + r.length, 0)} points`);

const data = {
  source: `© OpenStreetMap contributors (ODbL); boundaries as mapped on ${admin.fetched_at.slice(0, 10)}`,
  scale: SCALE,
  occupied,
  border: { rings: borderRings.map(encode) },
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(data));
console.log(`wrote ${path.relative(REPO, OUTPUT)} (${Math.round(fs.statSync(OUTPUT).size / 1024)} KB)`);
