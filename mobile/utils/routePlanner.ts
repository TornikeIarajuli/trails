/**
 * Day routes through a region: its best-known sights a short drive apart, in the order that
 * drives least, with the time on the road and at each stop, and one link that opens the whole
 * route in Google Maps. Pure functions over the places list.
 */
import type { PlaceKind, PlaceSummary } from '../services/places';
import { haversineDistance } from './geo';

/** Sights you drive to and look at; peaks, passes, huts and glaciers are hikes of their own. */
export const ROUTE_KINDS: ReadonlySet<PlaceKind> = new Set<PlaceKind>([
  'lake',
  'waterfall',
  'viewpoint',
  'canyon',
  'castle',
  'tower',
  'monastery',
  'cave',
  'hot_spring',
]);

/** Minutes people usually spend at each kind of stop. */
export const VISIT_MINUTES: Partial<Record<PlaceKind, number>> = {
  lake: 45,
  waterfall: 45,
  viewpoint: 20,
  canyon: 90,
  castle: 45,
  tower: 30,
  monastery: 40,
  cave: 60,
  hot_spring: 90,
};

/** Roads wind: the drive is about this much longer than the straight line. */
export const ROAD_FACTOR = 1.3;
/** Average speed on Georgia's regional and mountain roads. */
export const DRIVE_KMH = 40;
/** Higher than this, a "lake" or "waterfall" is almost always a hike from the road. */
const ROADSIDE_MAX_M = 2300;
/** Google Maps opens at most three stops on the way on a phone, plus the destination. */
export const MAX_STOPS = 4;
const MIN_STOPS = 3;
const SAME_KIND_MAX = 2;
/** Tbilisi: where most day trips start when we don't know where you are. */
export const TBILISI = { latitude: 41.7151, longitude: 44.8271 };

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface DayRoute {
  /** The route's main sight, which names it. */
  id: string;
  title: string;
  stops: PlaceSummary[];
  /** Kilometres on the road between the first and last stop. */
  driveKm: number;
  driveMinutes: number;
  visitMinutes: number;
  /** "2 waterfalls, a canyon and a monastery". */
  summary: string;
}

const km = (a: LatLng, b: LatLng) => haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude) / 1000;

function pathKm(stops: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < stops.length; i++) total += km(stops[i - 1], stops[i]);
  return total;
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]));
}

/** The order that drives least through all the stops, starting at the end nearer to `origin`. */
export function orderStops<T extends LatLng>(stops: T[], origin: LatLng = TBILISI): T[] {
  if (stops.length <= 2) {
    return stops.length === 2 && km(origin, stops[1]) < km(origin, stops[0]) ? [stops[1], stops[0]] : [...stops];
  }
  let best = stops;
  let bestKm = Infinity;
  for (const order of permutations(stops)) {
    // Coming from the origin counts, so of the two directions the nearer end goes first
    const total = km(origin, order[0]) + pathKm(order);
    if (total < bestKm - 1e-9) {
      best = order;
      bestKm = total;
    }
  }
  return best;
}

const ARTICLE: Partial<Record<PlaceKind, [string, string]>> = {
  lake: ['a lake', 'lakes'],
  waterfall: ['a waterfall', 'waterfalls'],
  viewpoint: ['a viewpoint', 'viewpoints'],
  canyon: ['a canyon', 'canyons'],
  castle: ['a fortress', 'fortresses'],
  tower: ['a tower', 'towers'],
  monastery: ['a monastery', 'monasteries'],
  cave: ['a cave', 'caves'],
  hot_spring: ['a hot spring', 'hot springs'],
};

const NUMBER_WORDS = ['', 'one', 'two', 'three', 'four'];

/** "Two waterfalls, a canyon and a monastery": the biggest group first, then in the order they come. */
export function routeSummary(stops: Pick<PlaceSummary, 'kind'>[]): string {
  const counts = new Map<PlaceKind, number>();
  for (const s of stops) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
  const parts = [...counts].sort((a, b) => b[1] - a[1]).map(([kind, n]) => {
    const [one, many] = ARTICLE[kind] ?? ['a sight', 'sights'];
    return n === 1 ? one : `${NUMBER_WORDS[n] ?? n} ${many}`;
  });
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const text = `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface PlanOptions {
  /** Stops at most this far from the main sight. */
  radiusKm?: number;
  maxRoutes?: number;
  origin?: LatLng;
}

/**
 * Up to `maxRoutes` day routes from a region's places: each starts from a notable sight not
 * used yet, adds the best sights near it (at most two of a kind), and orders them to drive least.
 */
export function planDayRoutes(places: PlaceSummary[], options: PlanOptions = {}): DayRoute[] {
  const radiusKm = options.radiusKm ?? 35;
  const maxRoutes = options.maxRoutes ?? 3;
  const origin = options.origin ?? TBILISI;
  const sights = places
    .filter((p) => ROUTE_KINDS.has(p.kind) && (p.elevation_m == null || p.elevation_m <= ROADSIDE_MAX_M))
    .sort((a, b) => b.notability - a.notability || a.name_en.localeCompare(b.name_en));

  const used = new Set<string>();
  const routes: DayRoute[] = [];
  for (const anchor of sights) {
    if (routes.length >= maxRoutes) break;
    if (used.has(anchor.id)) continue;
    const picked: PlaceSummary[] = [anchor];
    const perKind = new Map<PlaceKind, number>([[anchor.kind, 1]]);
    const candidates = sights
      .filter((p) => p.id !== anchor.id && !used.has(p.id))
      .map((p) => ({ place: p, distance: km(anchor, p) }))
      .filter((c) => c.distance <= radiusKm && c.distance >= 0.3)
      // Well-known first; distance breaks ties so a stop doesn't cost an hour for a little more fame
      .sort((a, b) => b.place.notability - b.distance / 15 - (a.place.notability - a.distance / 15));
    for (const { place } of candidates) {
      if (picked.length >= MAX_STOPS) break;
      if ((perKind.get(place.kind) ?? 0) >= SAME_KIND_MAX) continue;
      // Two stops in the same spot (a monastery and its tower) are one stop
      if (picked.some((p) => km(p, place) < 0.3)) continue;
      picked.push(place);
      perKind.set(place.kind, (perKind.get(place.kind) ?? 0) + 1);
    }
    if (picked.length < MIN_STOPS) continue;

    const stops = orderStops(picked, origin);
    const driveKm = Math.round(pathKm(stops) * ROAD_FACTOR);
    const visitMinutes = stops.reduce((m, s) => m + (VISIT_MINUTES[s.kind] ?? 30), 0);
    stops.forEach((s) => used.add(s.id));
    routes.push({
      id: anchor.id,
      title: anchor.name_en,
      stops,
      driveKm,
      driveMinutes: Math.round((driveKm / DRIVE_KMH) * 60),
      visitMinutes,
      summary: routeSummary(stops),
    });
  }
  return routes;
}

const point = (p: LatLng) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;

/**
 * Google Maps directions through every stop. Without an origin the app starts from where the
 * phone is.
 */
export function routeDirectionsUrl(stops: LatLng[], origin?: LatLng): string {
  if (stops.length === 0) return 'https://www.google.com/maps';
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1).map(point).join('|');
  const params = [
    'api=1',
    origin ? `origin=${point(origin)}` : null,
    `destination=${point(destination)}`,
    waypoints ? `waypoints=${encodeURIComponent(waypoints)}` : null,
    'travelmode=driving',
  ].filter(Boolean);
  return `https://www.google.com/maps/dir/?${params.join('&')}`;
}

/** "2 h 10 min", "45 min". */
export function formatMinutes(minutes: number): string {
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
