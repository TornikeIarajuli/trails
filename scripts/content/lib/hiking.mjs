// Pure trail maths: ascent/descent from an elevation profile, DIN 33466 walking time, difficulty.

/** Fills isolated gaps (null) by linear interpolation; returns null if too little data. */
export function fillGaps(elevs) {
  const known = elevs.filter((e) => typeof e === 'number').length;
  if (known < 2 || known < elevs.length * 0.8) return null;
  const out = elevs.slice();
  for (let i = 0; i < out.length; i++) {
    if (typeof out[i] === 'number') continue;
    let a = i - 1;
    while (a >= 0 && typeof out[a] !== 'number') a--;
    let b = i + 1;
    while (b < out.length && typeof out[b] !== 'number') b++;
    if (a < 0) out[i] = out[b];
    else if (b >= out.length) out[i] = out[a];
    else out[i] = out[a] + ((out[b] - out[a]) * (i - a)) / (b - a);
  }
  return out;
}

/** Light 1-2-1 smoothing; the end points stay as they are. */
export function smooth(elevs) {
  if (elevs.length < 3) return elevs.slice();
  return elevs.map((e, i) => (i === 0 || i === elevs.length - 1 ? e : (elevs[i - 1] + 2 * e + elevs[i + 1]) / 4));
}

/**
 * Total ascent and descent with hysteresis: a climb or drop only counts once the profile has
 * moved `thresholdM` away from the last turning point, so DEM ripple is not added up.
 */
export function ascentDescent(elevs, thresholdM = 10) {
  let ascent = 0;
  let descent = 0;
  if (elevs.length < 2) return { ascent, descent };
  let pivot = elevs[0];
  let ext = elevs[0];
  let trend = 0;
  for (let i = 1; i < elevs.length; i++) {
    const e = elevs[i];
    if (trend === 0) {
      if (e >= pivot + thresholdM) {
        trend = 1;
        ext = e;
      } else if (e <= pivot - thresholdM) {
        trend = -1;
        ext = e;
      }
    } else if (trend === 1) {
      if (e > ext) ext = e;
      else if (e <= ext - thresholdM) {
        ascent += ext - pivot;
        pivot = ext;
        trend = -1;
        ext = e;
      }
    } else if (e < ext) ext = e;
    else if (e >= ext + thresholdM) {
      descent += pivot - ext;
      pivot = ext;
      trend = 1;
      ext = e;
    }
  }
  if (trend === 1) ascent += ext - pivot;
  if (trend === -1) descent += pivot - ext;
  return { ascent, descent };
}

/** Everything derived from a sampled profile. `elevs` may contain nulls. */
export function profileStats(elevs, thresholdM = 10) {
  const filled = fillGaps(elevs);
  if (!filled) return null;
  const { ascent, descent } = ascentDescent(smooth(filled), thresholdM);
  return {
    ascent_m: Math.round(ascent),
    descent_m: Math.round(descent),
    min_m: Math.round(Math.min(...filled)),
    max_m: Math.round(Math.max(...filled)),
    start_m: Math.round(filled[0]),
    end_m: Math.round(filled[filled.length - 1]),
    samples: elevs.length,
    voids: elevs.filter((e) => typeof e !== 'number').length,
  };
}

/**
 * DIN 33466: 4 km/h on the flat, 300 m/h up, 500 m/h down;
 * total = the larger of horizontal and vertical time + half of the smaller.
 */
export function dinHours(distanceKm, ascentM, descentM) {
  const horizontal = distanceKm / 4;
  const vertical = ascentM / 300 + descentM / 500;
  return Math.max(horizontal, vertical) + Math.min(horizontal, vertical) / 2;
}

/** Rounded for display: nearest half hour, never below 0.5 h. */
export function roundHours(h) {
  return Math.max(0.5, Math.round(h * 2) / 2);
}

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'ultra'];

/** effort = km + ascent/100; <12 easy, <25 medium, <=45 hard, else ultra; one level up above 3000 m. */
export function difficultyFor(distanceKm, ascentM, maxElevationM) {
  const effort = distanceKm + ascentM / 100;
  let level = effort < 12 ? 0 : effort < 25 ? 1 : effort <= 45 ? 2 : 3;
  if (maxElevationM != null && maxElevationM > 3000) level = Math.min(3, level + 1);
  return { difficulty: DIFFICULTIES[level], effort: Math.round(effort * 10) / 10 };
}

export const difficultyGap = (a, b) => Math.abs(DIFFICULTIES.indexOf(a) - DIFFICULTIES.indexOf(b));

/**
 * Elevation profile for the app's chart: [distance_m, elevation_m] integer pairs, smoothed like the
 * ascent computation, at most maxPoints, evenly thinned but always keeping the first, the last, the
 * lowest and the highest sample. `elevs` are evenly spaced samples along a line of lengthM metres.
 */
export function elevationProfile(elevs, lengthM, maxPoints = 120) {
  const filled = fillGaps(elevs);
  if (!filled || filled.length < 2 || !(lengthM > 0)) return null;
  const sm = smooth(filled);
  const n = sm.length;
  let lo = 0;
  let hi = 0;
  sm.forEach((v, i) => {
    if (v < sm[lo]) lo = i;
    if (v > sm[hi]) hi = i;
  });
  const keep = new Set([0, n - 1, lo, hi]);
  if (n <= maxPoints) for (let i = 0; i < n; i++) keep.add(i);
  else {
    const slots = maxPoints - keep.size;
    for (let k = 1; k <= slots; k++) keep.add(Math.round((k * (n - 1)) / (slots + 1)));
  }
  return [...keep].sort((a, b) => a - b).map((i) => [Math.round((lengthM * i) / (n - 1)), Math.round(sm[i])]);
}
