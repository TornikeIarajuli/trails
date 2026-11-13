// Where is a point? Country / occupied territories / municipality → the app's tourist-region vocabulary.
// Polygons come from OSM administrative boundaries (content/work/osm-admin.json).
import path from 'node:path';
import { bbox, nearestOnLine, pointInRings } from './geo.mjs';
import { WORK, readJson } from './paths.mjs';

let admin = null;

function prep(area) {
  return { ...area, box: bbox(area.rings.flat()) };
}

function load() {
  if (admin) return admin;
  const raw = readJson(path.join(WORK, 'osm-admin.json'));
  admin = {
    country: prep(raw.country),
    occupied: raw.occupied.map(prep),
    regions: raw.regions.map(prep),
    municipalities: raw.municipalities.map(prep),
    parks: raw.parks.map(prep),
  };
  return admin;
}

const inBox = (p, b) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
const inside = (p, area) => inBox(p, area.box) && pointInRings(p, area.rings);

export const inGeorgia = (p) => inside(p, load().country);
export const occupiedAreaAt = (p) => load().occupied.find((a) => inside(p, a))?.name_en ?? null;
export const municipalityAt = (p) => load().municipalities.find((a) => inside(p, a)) ?? null;
export const level4At = (p) => load().regions.find((a) => inside(p, a)) ?? null;
export const parksAt = (p) => load().parks.filter((a) => inside(p, a));

/** Distance (m) from a point to the outline of an area, with a cheap bounding-box reject beyond maxM. */
function distanceToOutlineM(p, area, maxM) {
  const pad = maxM / 80000;
  const b = area.box;
  if (p[0] < b[0] - pad || p[0] > b[2] + pad || p[1] < b[1] - pad || p[1] > b[3] + pad) return Infinity;
  let best = Infinity;
  for (const ring of area.rings) {
    // coarse pass over vertices, exact pass around the closest one
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < ring.length; i += 1) {
      const d = Math.abs(ring[i][0] - p[0]) * 0.74 + Math.abs(ring[i][1] - p[1]);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    const from = Math.max(0, bi - 40);
    const to = Math.min(ring.length, bi + 41);
    const d = nearestOnLine(p, ring.slice(from, to)).distM;
    if (d < best) best = d;
  }
  return best;
}

/** Smallest distance (m) from any of the points to the occupied territories; 0 when a point is inside. */
export function distanceToOccupiedM(points, maxM = 20000) {
  let best = Infinity;
  for (const p of points) {
    for (const area of load().occupied) {
      if (inside(p, area)) return 0;
      const d = distanceToOutlineM(p, area, maxM);
      if (d < best) best = d;
    }
  }
  return best;
}

/** Smallest distance (m) from any of the points to the national border (outline of Georgia). */
export function distanceToBorderM(points, maxM = 20000) {
  let best = Infinity;
  for (const p of points) {
    const d = distanceToOutlineM(p, load().country, maxM);
    if (d < best) best = d;
  }
  return best;
}

export function distanceToTbilisiM(points) {
  const tbilisi = load().regions.find((r) => r.iso === 'GE-TB');
  let best = Infinity;
  for (const p of points) {
    if (inside(p, tbilisi)) return 0;
    const d = distanceToOutlineM(p, tbilisi, 60000);
    if (d < best) best = d;
  }
  return best;
}

const MUNICIPALITY_REGION = {
  Mestia: 'Svaneti', Lentekhi: 'Svaneti',
  Zugdidi: 'Samegrelo', Khobi: 'Samegrelo', Senaki: 'Samegrelo', Abasha: 'Samegrelo', Martvili: 'Samegrelo',
  Chkhorotsqu: 'Samegrelo', Tsalenjikha: 'Samegrelo', Poti: 'Samegrelo',
  Oni: 'Racha', Ambrolauri: 'Racha', Tsageri: 'Racha',
  Kazbegi: 'Kazbegi', Dusheti: 'Mtskheta-Mtianeti', Mtskheta: 'Mtskheta-Mtianeti', Tianeti: 'Mtskheta-Mtianeti',
  Akhmeta: 'Kakheti', Telavi: 'Kakheti', Gurjaani: 'Kakheti', Kvareli: 'Kakheti', Lagodekhi: 'Kakheti',
  Signagi: 'Kakheti', Dedoplistsqaro: 'Kakheti', Sagarejo: 'Kakheti',
  Rustavi: 'Kvemo Kartli', Marneuli: 'Kvemo Kartli', Gardabani: 'Kvemo Kartli', Tsalka: 'Kvemo Kartli',
  Dmanisi: 'Kvemo Kartli', Bolnisi: 'Kvemo Kartli', Tetritskaro: 'Kvemo Kartli',
  Khashuri: 'Shida Kartli', Kareli: 'Shida Kartli', Gori: 'Shida Kartli', Kaspi: 'Shida Kartli',
  Borjomi: 'Borjomi-Kharagauli', Adigeni: 'Samtskhe-Javakheti', Akhaltsikhe: 'Samtskhe-Javakheti',
  Aspindza: 'Samtskhe-Javakheti', Akhalkalaki: 'Samtskhe-Javakheti', Ninotsminda: 'Samtskhe-Javakheti',
  Kharagauli: 'Imereti', Zestaponi: 'Imereti', Terjola: 'Imereti', Chiatura: 'Imereti', Sachkhere: 'Imereti',
  Tqibuli: 'Imereti', Kutaisi: 'Imereti', Tskaltubo: 'Imereti', Khoni: 'Imereti', Samtredia: 'Imereti',
  Vani: 'Imereti', Baghdati: 'Imereti',
  Ozurgeti: 'Guria', Lanchkhuti: 'Guria', Chokhatauri: 'Guria',
  Batumi: 'Adjara', Khelvachauri: 'Adjara', Kobuleti: 'Adjara', Keda: 'Adjara', Shuakhevi: 'Adjara', Khulo: 'Adjara',
};

const LEVEL4_REGION = {
  'GE-AJ': 'Adjara', 'GE-GU': 'Guria', 'GE-SJ': 'Samtskhe-Javakheti', 'GE-SZ': 'Samegrelo', 'GE-TB': 'Tbilisi',
  'GE-RL': 'Racha', 'GE-IM': 'Imereti', 'GE-SK': 'Shida Kartli', 'GE-MM': 'Mtskheta-Mtianeti', 'GE-KA': 'Kakheti',
  'GE-KK': 'Kvemo Kartli',
};

const isTushetiPark = (p) => /^Tusheti /.test(p.name_en ?? '');
const isBorjomiPark = (p) => /^(Borjom-Kharagauli National Park|Borjomi Nature Reserve|Nedzvi Managed Reserve)$/.test(p.name_en ?? '');

/** Tourist region of one point, or null outside Georgian-controlled territory. */
export function touristRegionAt(p) {
  if (!inGeorgia(p) || occupiedAreaAt(p)) return null;
  const parks = parksAt(p);
  if (parks.some(isBorjomiPark)) return 'Borjomi-Kharagauli';
  const level4 = level4At(p);
  if (level4?.iso === 'GE-TB') return 'Tbilisi';
  const muni = municipalityAt(p);
  const key = (muni?.name_en ?? '').replace(/ Municipality$/, '');
  if (key === 'Akhmeta' && parks.some(isTushetiPark)) return 'Tusheti';
  if (key === 'Dusheti' && p[1] >= 42.44 && p[0] >= 44.86) return 'Khevsureti';
  return MUNICIPALITY_REGION[key] ?? LEVEL4_REGION[level4?.iso] ?? null;
}

/**
 * Region shares along a route: { majority, start, mid, shares: { region: share }, municipalities[] }.
 * `points` should be evenly spaced samples.
 */
export function regionProfile(points) {
  const counts = {};
  const munis = new Map();
  for (const p of points) {
    const r = touristRegionAt(p) ?? '(outside)';
    counts[r] = (counts[r] ?? 0) + 1;
    const m = municipalityAt(p)?.name_en;
    if (m) munis.set(m, (munis.get(m) ?? 0) + 1);
  }
  const shares = Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Math.round((v / points.length) * 100) / 100]));
  const majority = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  return {
    majority,
    start: touristRegionAt(points[0]),
    mid: touristRegionAt(points[Math.floor(points.length / 2)]),
    end: touristRegionAt(points[points.length - 1]),
    shares,
    municipalities: [...munis.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m),
    parks: [...new Set(points.filter((_, i) => i % 5 === 0).flatMap((p) => parksAt(p).map((k) => k.name_en ?? k.name)))],
  };
}
