import { haversineDistance } from './geo';
import type { Checkpoint } from '../types/checkpoint';

export interface ProfilePoint {
  /** Metres along the route from its start. */
  distance: number;
  /** Metres above sea level. */
  elevation: number;
}

/** Vertical window of the chart. Never narrower than this, so gentle trails look gentle. */
export const MIN_ELEVATION_SPAN_M = 200;
/** Climbs and drops smaller than this are treated as terrain-model noise, as in the content pipeline. */
export const ELEVATION_HYSTERESIS_M = 10;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Reads the `elevation_profile` column: `[distance_m, elevation_m]` pairs. Invalid
 * pairs are dropped, the rest is sorted by distance and repeated distances keep
 * their first value. Fewer than two usable points means there is no profile.
 */
export function normaliseProfile(raw: unknown): ProfilePoint[] {
  if (!Array.isArray(raw)) return [];
  const points = raw
    .filter((pair): pair is [number, number] =>
      Array.isArray(pair) && isFiniteNumber(pair[0]) && isFiniteNumber(pair[1]) && pair[0] >= 0,
    )
    .map(([distance, elevation]) => ({ distance, elevation }))
    .sort((a, b) => a.distance - b.distance);

  const unique: ProfilePoint[] = [];
  for (const point of points) {
    if (unique.length > 0 && unique[unique.length - 1].distance === point.distance) continue;
    unique.push(point);
  }
  return unique.length >= 2 ? unique : [];
}

/**
 * Fallback profile from checkpoint elevations, used only when the trail has no
 * measured profile. Needs at least three checkpoints with an elevation: with two,
 * the "profile" is a straight ramp that says nothing about the terrain.
 * Checkpoints are placed by the straight-line distance between them, or spread
 * evenly over the trail length when some have no coordinates.
 */
export function checkpointProfile(checkpoints: Checkpoint[], distanceKm: number | null | undefined): ProfilePoint[] {
  const withElevation = checkpoints
    .filter((cp) => isFiniteNumber(cp.elevation_m))
    .sort((a, b) => a.sort_order - b.sort_order);
  if (withElevation.length < 3) return [];

  const coordinates = withElevation.map((cp) => cp.coordinates?.coordinates);
  const allPlaced = coordinates.every(
    (c) => Array.isArray(c) && isFiniteNumber(c[0]) && isFiniteNumber(c[1]),
  );

  if (allPlaced) {
    let travelled = 0;
    const points = withElevation.map((cp, i) => {
      if (i > 0) {
        const [lng1, lat1] = coordinates[i - 1]!;
        const [lng2, lat2] = coordinates[i]!;
        travelled += haversineDistance(lat1, lng1, lat2, lng2);
      }
      return { distance: travelled, elevation: cp.elevation_m as number };
    });
    if (travelled > 0) return normaliseProfile(points.map((p) => [p.distance, p.elevation]));
  }

  const length = isFiniteNumber(distanceKm) && distanceKm > 0 ? distanceKm * 1000 : withElevation.length - 1;
  const step = length / (withElevation.length - 1);
  return withElevation.map((cp, i) => ({ distance: i * step, elevation: cp.elevation_m as number }));
}

/**
 * The elevation range shown on the vertical axis: the data's range, widened to at
 * least `minSpan` around its middle, and kept at or above 0 m.
 */
export function elevationScale(points: ProfilePoint[], minSpan = MIN_ELEVATION_SPAN_M): { lo: number; hi: number } {
  const elevations = points.map((p) => p.elevation);
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);

  let lo = min;
  let hi = max;
  if (max - min < minSpan) {
    const middle = (min + max) / 2;
    lo = middle - minSpan / 2;
    hi = middle + minSpan / 2;
  }
  if (lo < 0 && min >= 0) {
    hi -= lo;
    lo = 0;
  }
  return { lo, hi };
}

export interface ElevationStats {
  min: number;
  max: number;
  ascent: number;
  descent: number;
  distance: number;
}

/**
 * Min/max and the total climb and descent along the profile. A change only counts
 * once it exceeds `threshold` metres from the last counted point, which filters
 * out the small ups and downs of terrain-model noise.
 */
export function elevationStats(points: ProfilePoint[], threshold = ELEVATION_HYSTERESIS_M): ElevationStats {
  const elevations = points.map((p) => p.elevation);
  let ascent = 0;
  let descent = 0;
  let reference = elevations[0];

  for (const elevation of elevations.slice(1)) {
    const change = elevation - reference;
    if (change >= threshold) {
      ascent += change;
      reference = elevation;
    } else if (-change >= threshold) {
      descent -= change;
      reference = elevation;
    }
  }

  return {
    min: Math.min(...elevations),
    max: Math.max(...elevations),
    ascent: Math.round(ascent),
    descent: Math.round(descent),
    distance: points[points.length - 1].distance - points[0].distance,
  };
}

export interface ChartPoint {
  x: number;
  y: number;
}

/** Profile points in chart pixels: x from the start of the route, y down from the top. */
export function toChartPoints(
  points: ProfilePoint[],
  scale: { lo: number; hi: number },
  width: number,
  height: number,
): ChartPoint[] {
  const start = points[0].distance;
  const length = points[points.length - 1].distance - start || 1;
  const span = scale.hi - scale.lo || 1;
  return points.map((p) => ({
    x: ((p.distance - start) / length) * width,
    y: height - ((p.elevation - scale.lo) / span) * height,
  }));
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * A smooth SVG path through the points (monotone cubic interpolation). Unlike a
 * plain spline it never overshoots between two points, so it cannot invent a peak
 * or a dip that is not in the data.
 */
export function smoothLinePath(points: ChartPoint[]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M${round(points[0].x)},${round(points[0].y)}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x);
    slope.push(dx[i] === 0 ? 0 : (points[i + 1].y - points[i].y) / dx[i]);
  }

  // Tangents (Fritsch–Carlson): zero at local extrema, harmonic-style blend elsewhere
  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      tangent.push(0);
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangent.push((w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]));
    }
  }
  tangent.push(slope[n - 2]);

  let d = `M${round(points[0].x)},${round(points[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const third = dx[i] / 3;
    d +=
      ` C${round(p0.x + third)},${round(p0.y + tangent[i] * third)}` +
      ` ${round(p1.x - third)},${round(p1.y - tangent[i + 1] * third)}` +
      ` ${round(p1.x)},${round(p1.y)}`;
  }
  return d;
}

/** The same curve closed down to the bottom edge, for the filled area under it. */
export function smoothAreaPath(points: ChartPoint[], height: number): string {
  if (points.length < 2) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${smoothLinePath(points)} L${round(last.x)},${height} L${round(first.x)},${height} Z`;
}
