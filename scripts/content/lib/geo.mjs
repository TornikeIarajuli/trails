// Geometry helpers. Coordinates are always [lng, lat] (GeoJSON order).

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

export function haversineM(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function lineLengthM(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineM(coords[i - 1], coords[i]);
  return total;
}

export function maxSegmentM(coords) {
  let max = 0;
  let at = -1;
  for (let i = 1; i < coords.length; i++) {
    const d = haversineM(coords[i - 1], coords[i]);
    if (d > max) {
      max = d;
      at = i;
    }
  }
  return { max, at };
}

/** Local equirectangular projection (metres) around a reference latitude — fine for trail-sized extents. */
export function projector(refLat) {
  const kx = (Math.PI / 180) * R * Math.cos(rad(refLat));
  const ky = (Math.PI / 180) * R;
  return {
    fwd: (p) => [p[0] * kx, p[1] * ky],
    inv: (q) => [q[0] / kx, q[1] / ky],
  };
}

function segDist2(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const x = a[0] + t * dx;
  const y = a[1] + t * dy;
  return { d2: (p[0] - x) ** 2 + (p[1] - y) ** 2, t, x, y };
}

/** Douglas–Peucker in projected metres; returns the kept indexes. */
function dpIndexes(pts, tolM) {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  const tol2 = tolM * tolM;
  while (stack.length) {
    const [a, b] = stack.pop();
    let worst = -1;
    let worstD = tol2;
    for (let i = a + 1; i < b; i++) {
      const { d2 } = segDist2(pts[i], pts[a], pts[b]);
      if (d2 > worstD) {
        worstD = d2;
        worst = i;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return keep;
}

export function simplifyDP(coords, tolM) {
  if (coords.length <= 2) return coords.slice();
  const proj = projector(coords[Math.floor(coords.length / 2)][1]);
  const keep = dpIndexes(coords.map(proj.fwd), tolM);
  return coords.filter((_, i) => keep[i]);
}

/** Smallest Douglas–Peucker tolerance (>= minTolM) that brings the line to <= maxPoints. */
export function simplifyToMaxPoints(coords, maxPoints = 600, minTolM = 1) {
  const deduped = dedupeConsecutive(coords);
  if (deduped.length <= maxPoints) return { coords: deduped, toleranceM: 0 };
  let lo = minTolM;
  let hi = minTolM;
  let best = simplifyDP(deduped, hi);
  while (best.length > maxPoints) {
    lo = hi;
    hi *= 2;
    best = simplifyDP(deduped, hi);
  }
  for (let i = 0; i < 14 && hi - lo > 0.25; i++) {
    const mid = (lo + hi) / 2;
    const cand = simplifyDP(deduped, mid);
    if (cand.length <= maxPoints) {
      hi = mid;
      best = cand;
    } else lo = mid;
  }
  return { coords: best, toleranceM: Math.round(hi * 10) / 10 };
}

export function dedupeConsecutive(coords) {
  const out = [];
  for (const c of coords) {
    const last = out[out.length - 1];
    if (!last || last[0] !== c[0] || last[1] !== c[1]) out.push(c);
  }
  return out;
}

/** Cumulative distance (metres) at each vertex. */
export function cumulativeM(coords) {
  const cum = new Float64Array(coords.length);
  for (let i = 1; i < coords.length; i++) cum[i] = cum[i - 1] + haversineM(coords[i - 1], coords[i]);
  return cum;
}

/** Point at a distance along the line. */
export function pointAtM(coords, cum, m) {
  if (m <= 0) return coords[0];
  const total = cum[cum.length - 1];
  if (m >= total) return coords[coords.length - 1];
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= m) lo = mid;
    else hi = mid;
  }
  const span = cum[hi] - cum[lo];
  const t = span === 0 ? 0 : (m - cum[lo]) / span;
  return [coords[lo][0] + t * (coords[hi][0] - coords[lo][0]), coords[lo][1] + t * (coords[hi][1] - coords[lo][1])];
}

/**
 * Evenly spaced samples along a line, at most `spacingM` apart and at most `maxSamples` in total.
 * Returns [{ m, p }] including both ends.
 */
export function sampleAlong(coords, spacingM, maxSamples = Infinity) {
  const cum = cumulativeM(coords);
  const total = cum[cum.length - 1];
  if (total === 0) return [{ m: 0, p: coords[0] }];
  let n = Math.max(2, Math.ceil(total / spacingM) + 1);
  if (n > maxSamples) n = maxSamples;
  const out = [];
  for (let i = 0; i < n; i++) {
    const m = (total * i) / (n - 1);
    out.push({ m, p: pointAtM(coords, cum, m) });
  }
  return out;
}

/** Nearest point on a polyline: { distM, index (segment start), point, alongM }. */
export function nearestOnLine(p, coords, cum = null) {
  const proj = projector(p[1]);
  const q = proj.fwd(p);
  let best = { d2: Infinity, index: 0, t: 0, x: 0, y: 0 };
  let a = proj.fwd(coords[0]);
  if (coords.length === 1) best = { d2: (q[0] - a[0]) ** 2 + (q[1] - a[1]) ** 2, index: 0, t: 0, x: a[0], y: a[1] };
  for (let i = 1; i < coords.length; i++) {
    const b = proj.fwd(coords[i]);
    const r = segDist2(q, a, b);
    if (r.d2 < best.d2) best = { ...r, index: i - 1 };
    a = b;
  }
  const point = proj.inv([best.x, best.y]);
  let alongM = null;
  if (cum) {
    const span = coords.length > 1 ? cum[Math.min(best.index + 1, cum.length - 1)] - cum[best.index] : 0;
    alongM = cum[best.index] + best.t * span;
  }
  return { distM: Math.sqrt(best.d2), index: best.index, point, alongM };
}

/** Uniform grid over polyline segments for fast "how far is this point from the line" queries. */
export class LineIndex {
  constructor(coords, cellM = 400) {
    this.coords = coords;
    this.proj = projector(coords[Math.floor(coords.length / 2)][1]);
    this.pts = coords.map(this.proj.fwd);
    this.cell = cellM;
    this.grid = new Map();
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1];
      const b = this.pts[i];
      const x0 = Math.floor(Math.min(a[0], b[0]) / cellM);
      const x1 = Math.floor(Math.max(a[0], b[0]) / cellM);
      const y0 = Math.floor(Math.min(a[1], b[1]) / cellM);
      const y1 = Math.floor(Math.max(a[1], b[1]) / cellM);
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++) {
          const k = `${x},${y}`;
          let arr = this.grid.get(k);
          if (!arr) this.grid.set(k, (arr = []));
          arr.push(i - 1);
        }
    }
  }

  /** Distance in metres if within `maxM`, otherwise Infinity. */
  distanceWithin(p, maxM) {
    const q = this.proj.fwd(p);
    const r = Math.ceil(maxM / this.cell);
    const cx = Math.floor(q[0] / this.cell);
    const cy = Math.floor(q[1] / this.cell);
    let best = Infinity;
    for (let x = cx - r; x <= cx + r; x++)
      for (let y = cy - r; y <= cy + r; y++) {
        const arr = this.grid.get(`${x},${y}`);
        if (!arr) continue;
        for (const i of arr) {
          const { d2 } = segDist2(q, this.pts[i], this.pts[i + 1]);
          if (d2 < best) best = d2;
        }
      }
    const d = Math.sqrt(best);
    return d <= maxM ? d : Infinity;
  }
}

/** Share (0..1) of line A's length that lies within `tolM` of line B. */
export function overlapShare(aCoords, bIndex, tolM = 100, spacingM = 100) {
  const samples = sampleAlong(aCoords, spacingM, 1500);
  let hit = 0;
  for (const s of samples) if (bIndex.distanceWithin(s.p, tolM) !== Infinity) hit++;
  return hit / samples.length;
}

export function bbox(coords) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

export function bboxesIntersect(a, b, padDeg = 0) {
  return a[0] - padDeg <= b[2] && a[2] + padDeg >= b[0] && a[1] - padDeg <= b[3] && a[3] + padDeg >= b[1];
}

/** Ray-casting point-in-polygon for a set of rings (even-odd rule handles holes). */
export function pointInRings(p, rings) {
  let inside = false;
  const [x, y] = p;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Joins ways (arrays of [lng,lat]) that share end nodes into closed rings. */
export function assembleRings(ways) {
  const key = (c) => `${c[0].toFixed(7)},${c[1].toFixed(7)}`;
  const pending = ways.filter((w) => w.length >= 2).map((w) => w.slice());
  const rings = [];
  while (pending.length) {
    let ring = pending.pop();
    let grown = true;
    while (grown && key(ring[0]) !== key(ring[ring.length - 1])) {
      grown = false;
      const tail = key(ring[ring.length - 1]);
      for (let i = 0; i < pending.length; i++) {
        const w = pending[i];
        if (key(w[0]) === tail) {
          ring = ring.concat(w.slice(1));
        } else if (key(w[w.length - 1]) === tail) {
          ring = ring.concat(w.slice(0, -1).reverse());
        } else continue;
        pending.splice(i, 1);
        grown = true;
        break;
      }
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

/** Point index: buckets [lng,lat] items into ~cellDeg cells for radius queries. */
export class PointIndex {
  constructor(items, getCoord, cellDeg = 0.02) {
    this.cell = cellDeg;
    this.getCoord = getCoord;
    this.grid = new Map();
    for (const it of items) {
      const c = getCoord(it);
      const k = `${Math.floor(c[0] / cellDeg)},${Math.floor(c[1] / cellDeg)}`;
      let arr = this.grid.get(k);
      if (!arr) this.grid.set(k, (arr = []));
      arr.push(it);
    }
  }

  /** Items whose coordinate falls inside the bbox (padded by padDeg). */
  inBbox(box, padDeg = 0) {
    const out = [];
    const x0 = Math.floor((box[0] - padDeg) / this.cell);
    const x1 = Math.floor((box[2] + padDeg) / this.cell);
    const y0 = Math.floor((box[1] - padDeg) / this.cell);
    const y1 = Math.floor((box[3] + padDeg) / this.cell);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        const arr = this.grid.get(`${x},${y}`);
        if (arr) out.push(...arr);
      }
    return out;
  }
}
