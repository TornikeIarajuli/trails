/**
 * Decides whether a recorded GPS track plausibly walked a trail. Pure: no I/O.
 *
 * A hike is verified when the track passes within `toleranceM` of at least `minCoverage`
 * of the route's vertices and the average speed over the trail's distance is at most
 * `maxSpeedKmh`.
 */

const EARTH_RADIUS_M = 6_371_008.8;
const DEG = Math.PI / 180;
// Grid cells are never smaller than this, so cell indices stay small integers.
const MIN_CELL_M = 10;
// Cell index packing: x * 2^22 + y is unique while |y| < 2^21, which holds for
// cells of at least MIN_CELL_M (a quarter meridian is 1e7 m).
const CELL_KEY_STRIDE = 4_194_304;

export type VerificationReason =
  | 'ok'
  | 'no_track'
  | 'low_coverage'
  | 'too_fast'
  | 'no_route';

export interface HikeThresholds {
  /** A route vertex counts as passed when a track point lies within this many meters. */
  toleranceM: number;
  /** Share of route vertices (0..1) that must be passed. */
  minCoverage: number;
  /** Highest plausible average speed over the trail's distance, in km/h. */
  maxSpeedKmh: number;
}

export interface HikeVerificationInput {
  /** The trail's route as [lng, lat] pairs (GeoJSON order). */
  route: ReadonlyArray<readonly number[]> | null | undefined;
  trailDistanceKm: number | null | undefined;
  /** The recorded track as [lat, lng, unixSeconds] triples. */
  track: ReadonlyArray<readonly number[]> | null | undefined;
  /** Moving time reported by the app; derived from the track timestamps when missing. */
  elapsedSeconds?: number | null;
  thresholds: HikeThresholds;
}

export interface HikeVerificationResult {
  verified: boolean;
  /** Share of route vertices the track passed, 0..1, rounded to 3 decimals. */
  coverage: number;
  reason: VerificationReason;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isLatLng = (lat: unknown, lng: unknown): boolean =>
  isFiniteNumber(lat) &&
  isFiniteNumber(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;

/** Equirectangular approximation of the distance between two points, in meters. */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const x = (lng2 - lng1) * DEG * Math.cos(((lat1 + lat2) / 2) * DEG);
  const y = (lat2 - lat1) * DEG;
  return EARTH_RADIUS_M * Math.sqrt(x * x + y * y);
}

/**
 * [lng, lat] pairs of a GeoJSON LineString as PostgREST returns a geometry column
 * (an object, possibly with a `crs` member, or its JSON text). Anything else yields [].
 */
export function parseRouteCoordinates(route: unknown): Array<[number, number]> {
  let geometry = route;
  if (typeof geometry === 'string') {
    try {
      geometry = JSON.parse(geometry);
    } catch {
      return [];
    }
  }
  if (!geometry || typeof geometry !== 'object') return [];

  const { type, coordinates } = geometry as {
    type?: unknown;
    coordinates?: unknown;
  };
  if (type !== 'LineString' || !Array.isArray(coordinates)) return [];

  const points: Array<[number, number]> = [];
  for (const position of coordinates) {
    if (!Array.isArray(position)) continue;
    const [lng, lat] = position as unknown[];
    if (isLatLng(lat, lng)) points.push([lng as number, lat as number]);
  }
  return points;
}

/** Seconds between the earliest and the latest timestamp of a track, or null. */
export function trackDurationSeconds(
  track: ReadonlyArray<readonly number[]> | null | undefined,
): number | null {
  let first = Infinity;
  let last = -Infinity;
  for (const point of track ?? []) {
    const time = point?.[2];
    if (!isFiniteNumber(time)) continue;
    if (time < first) first = time;
    if (time > last) last = time;
  }
  return Number.isFinite(first) ? last - first : null;
}

/**
 * Share of `route` vertices ([lng, lat]) that have a `track` point ([lat, lng]) within
 * `toleranceM`. Points are bucketed in a grid of tolerance-sized cells, so each vertex
 * only looks at the points in its own and the eight neighbouring cells.
 */
function routeCoverage(
  route: ReadonlyArray<readonly [number, number]>,
  track: ReadonlyArray<readonly [number, number]>,
  toleranceM: number,
): number {
  // Local equirectangular projection around the route's mean latitude. Across a trail
  // its error is far below any sensible tolerance.
  let latSum = 0;
  for (const [, lat] of route) latSum += lat;
  const kx = EARTH_RADIUS_M * DEG * Math.cos((latSum / route.length) * DEG);
  const ky = EARTH_RADIUS_M * DEG;

  const cell = Math.max(toleranceM, MIN_CELL_M);
  const grid = new Map<number, number[]>();
  for (const [lat, lng] of track) {
    const x = lng * kx;
    const y = lat * ky;
    const key = Math.floor(x / cell) * CELL_KEY_STRIDE + Math.floor(y / cell);
    const bucket = grid.get(key);
    if (bucket) bucket.push(x, y);
    else grid.set(key, [x, y]);
  }

  const tolerance2 = toleranceM * toleranceM;
  let passed = 0;
  for (const [lng, lat] of route) {
    const x = lng * kx;
    const y = lat * ky;
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);

    search: for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get((cx + dx) * CELL_KEY_STRIDE + (cy + dy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i += 2) {
          const ex = bucket[i] - x;
          const ey = bucket[i + 1] - y;
          if (ex * ex + ey * ey <= tolerance2) {
            passed++;
            break search;
          }
        }
      }
    }
  }
  return passed / route.length;
}

export function verifyHike(
  input: HikeVerificationInput,
): HikeVerificationResult {
  const track: Array<[number, number]> = [];
  for (const point of input.track ?? []) {
    if (Array.isArray(point) && isLatLng(point[0], point[1])) {
      track.push([point[0], point[1]]);
    }
  }
  if (track.length < 2) {
    return { verified: false, coverage: 0, reason: 'no_track' };
  }

  const route: Array<[number, number]> = [];
  for (const vertex of input.route ?? []) {
    if (Array.isArray(vertex) && isLatLng(vertex[1], vertex[0])) {
      route.push([vertex[0], vertex[1]]);
    }
  }
  if (route.length < 2) {
    return { verified: false, coverage: 0, reason: 'no_route' };
  }

  const { toleranceM, minCoverage, maxSpeedKmh } = input.thresholds;
  const coverage =
    Math.round(routeCoverage(route, track, toleranceM) * 1000) / 1000;
  if (coverage < minCoverage) {
    return { verified: false, coverage, reason: 'low_coverage' };
  }

  const distanceKm = input.trailDistanceKm;
  if (isFiniteNumber(distanceKm) && distanceKm > 0) {
    const reported = input.elapsedSeconds;
    const elapsed =
      isFiniteNumber(reported) && reported > 0
        ? reported
        : (trackDurationSeconds(input.track) ?? 0);
    const speedKmh = elapsed > 0 ? distanceKm / (elapsed / 3600) : Infinity;
    if (speedKmh > maxSpeedKmh) {
      return { verified: false, coverage, reason: 'too_fast' };
    }
  }

  return { verified: true, coverage, reason: 'ok' };
}
