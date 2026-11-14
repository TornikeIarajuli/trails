/**
 * How close a position is to the occupation line or the state border, and what to tell the
 * hiker about it. Works offline: the lines are bundled with the app
 * (assets/data/border-lines.json, built by scripts/build-line-data.mjs from OpenStreetMap).
 *
 * Distances are approximate. The line on the ground is often unmarked and can differ from the
 * map, so the warnings start well before it.
 */
import rawLines from '../assets/data/border-lines.json';

/**
 * Warn this far from the occupation line as mapped… The fences on the ground have been moved
 * into Georgian-controlled land in places, so the margin is generous.
 */
export const OCCUPATION_WARN_M = 1500;
/** …and urge turning back this close to it (or past it). */
export const OCCUPATION_CLOSE_M = 500;
/** Warn this far from the state border. */
export const BORDER_WARN_M = 500;
/** A warning holds until the hiker is this much further away than where it started. */
const EXIT_FACTOR = 1.5;
/** The same warning is not repeated within this time, even after leaving and coming back. */
export const REPEAT_AFTER_MS = 15 * 60 * 1000;

// Nothing beyond this distance matters; lets most rings be skipped by their bounding box
const LOOK_M = OCCUPATION_WARN_M * EXIT_FACTOR + 500;

export type LineLevel = 'none' | 'border' | 'occupation' | 'occupation_close';

const RANK: Record<LineLevel, number> = { none: 0, border: 1, occupation: 2, occupation_close: 3 };

interface Ring {
  /** lng, lat, lng, lat, … */
  coords: number[];
  box: [number, number, number, number];
}

interface Area {
  name_en: string;
  name_ka: string | null;
  rings: Ring[];
}

interface RawLines {
  scale: number;
  occupied: { name_en: string; name_ka?: string | null; rings: number[][] }[];
  border: { rings: number[][] };
}

function decodeRing(deltas: number[], scale: number): Ring {
  const coords: number[] = [];
  let x = 0;
  let y = 0;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (let i = 0; i + 1 < deltas.length; i += 2) {
    x += deltas[i];
    y += deltas[i + 1];
    const lng = x / scale;
    const lat = y / scale;
    coords.push(lng, lat);
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { coords, box: [minLng, minLat, maxLng, maxLat] };
}

export interface LineData {
  occupied: Area[];
  border: Ring[];
}

export function decodeLines(raw: RawLines): LineData {
  return {
    occupied: raw.occupied.map((area) => ({
      name_en: area.name_en,
      name_ka: area.name_ka ?? null,
      rings: area.rings.map((ring) => decodeRing(ring, raw.scale)),
    })),
    border: raw.border.rings.map((ring) => decodeRing(ring, raw.scale)),
  };
}

let bundled: LineData | null = null;
const bundledLines = () => (bundled ??= decodeLines(rawLines as RawLines));

/** Ring as plain [lng, lat] pairs, for tests and synthetic lines. */
export function ringFrom(points: [number, number][]): Ring {
  return decodeRing(
    points.flatMap(([lng, lat], i) =>
      i === 0
        ? [Math.round(lng * 1e5), Math.round(lat * 1e5)]
        : [Math.round(lng * 1e5) - Math.round(points[i - 1][0] * 1e5), Math.round(lat * 1e5) - Math.round(points[i - 1][1] * 1e5)],
    ),
    1e5,
  );
}

function inBox(lat: number, lng: number, box: Ring['box'], padM: number): boolean {
  const padLat = padM / 110540;
  const padLng = padM / (111320 * Math.cos((lat * Math.PI) / 180));
  return lng >= box[0] - padLng && lng <= box[2] + padLng && lat >= box[1] - padLat && lat <= box[3] + padLat;
}

/** Distance (m) from the point to the ring's outline; Infinity when it is further than maxM. */
function distanceToRingM(lat: number, lng: number, ring: Ring, maxM: number): number {
  if (!inBox(lat, lng, ring.box, maxM)) return Infinity;
  // Local plane around the point: x east, y north, in metres; the point is the origin
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110540;
  const c = ring.coords;
  let best = Infinity;
  let ax = (c[0] - lng) * kx;
  let ay = (c[1] - lat) * ky;
  for (let i = 2; i + 1 < c.length; i += 2) {
    const bx = (c[i] - lng) * kx;
    const by = (c[i + 1] - lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best) best = d;
    ax = bx;
    ay = by;
  }
  return best <= maxM ? best : Infinity;
}

/** Whether the point is inside the ring (ray casting on lng/lat). */
function insideRing(lat: number, lng: number, ring: Ring): boolean {
  if (!inBox(lat, lng, ring.box, 0)) return false;
  const c = ring.coords;
  let inside = false;
  for (let i = 0, j = c.length - 2; i + 1 < c.length; j = i, i += 2) {
    const xi = c[i];
    const yi = c[i + 1];
    const xj = c[j];
    const yj = c[j + 1];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface LineCheck {
  /** The nearest occupied area within reach, or null. */
  occupation: { name_en: string; name_ka: string | null; distanceM: number; inside: boolean } | null;
  /** Distance to the state border when within reach, else null. */
  borderM: number | null;
}

/** How far the position is from the occupation line and the state border (within ~2 km). */
export function checkLines(lat: number, lng: number, lines: LineData = bundledLines()): LineCheck {
  let occupation: LineCheck['occupation'] = null;
  for (const area of lines.occupied) {
    const inside = area.rings.some((ring) => insideRing(lat, lng, ring));
    const distanceM = inside ? 0 : Math.min(...area.rings.map((ring) => distanceToRingM(lat, lng, ring, LOOK_M)));
    if (distanceM === Infinity) continue;
    if (!occupation || distanceM < occupation.distanceM) {
      occupation = { name_en: area.name_en, name_ka: area.name_ka, distanceM, inside };
    }
  }
  const borderM = Math.min(...lines.border.map((ring) => distanceToRingM(lat, lng, ring, LOOK_M)));
  return { occupation, borderM: borderM === Infinity ? null : borderM };
}

function levelWithin(check: LineCheck, factor: number): LineLevel {
  const occupation = check.occupation;
  if (occupation && (occupation.inside || occupation.distanceM <= OCCUPATION_CLOSE_M * factor)) return 'occupation_close';
  if (occupation && occupation.distanceM <= OCCUPATION_WARN_M * factor) return 'occupation';
  if (check.borderM != null && check.borderM <= BORDER_WARN_M * factor) return 'border';
  return 'none';
}

/**
 * The warning level for a position, given the one shown now: a level starts at its distance
 * and holds until the hiker is half as far again, so GPS jitter at the edge does not flicker.
 */
export function nextLevel(check: LineCheck, current: LineLevel): LineLevel {
  const entered = levelWithin(check, 1);
  if (RANK[entered] >= RANK[current]) return entered;
  const held = levelWithin(check, EXIT_FACTOR);
  return RANK[held] >= RANK[current] ? current : held;
}

/** "about 650 m": rounded to 50 m, never "0 m". */
export function aboutDistance(distanceM: number): string {
  return `about ${Math.max(50, Math.round(distanceM / 50) * 50)} m`;
}

export interface LineWarning {
  level: Exclude<LineLevel, 'none'>;
  title: string;
  body: string;
}

/** What to tell the hiker at a level: one short title and one sentence of what to do. */
export function describeLevel(level: LineLevel, check: LineCheck, language: string = 'en'): LineWarning | null {
  const occupation = check.occupation;
  const area = occupation ? (language === 'ka' && occupation.name_ka) || occupation.name_en : null;
  switch (level) {
    case 'occupation_close':
      if (occupation?.inside) {
        return {
          level,
          title: 'You may have crossed the occupation line',
          body: 'Go back the way you came, now. If you need help, call 112.',
        };
      }
      return {
        level,
        title: `Occupation line ${aboutDistance(occupation?.distanceM ?? OCCUPATION_CLOSE_M)} away`,
        body: 'Turn back along the trail. People near the line have been detained.',
      };
    case 'occupation':
      return {
        level,
        title: `Occupation line ${aboutDistance(occupation?.distanceM ?? OCCUPATION_WARN_M)} away`,
        body: `Don't go further toward ${area ?? 'the occupied territory'}. The line is often not marked.`,
      };
    case 'border':
      return {
        level,
        title: `State border ${aboutDistance(check.borderM ?? BORDER_WARN_M)} away`,
        body: "Stay on the trail and don't cross it. Carry your passport.",
      };
    default:
      return null;
  }
}

export interface WatchState {
  level: LineLevel;
  /** When each level was last alerted. */
  alertedAt: Partial<Record<LineLevel, number>>;
}

export const IDLE_WATCH: WatchState = { level: 'none', alertedAt: {} };

/**
 * One GPS fix through the warning logic: the new level, and an alert when the hiker just got
 * closer to a line than before (not again for the same level within REPEAT_AFTER_MS).
 */
export function watchStep(
  state: WatchState,
  check: LineCheck,
  now: number,
): { state: WatchState; alert: boolean } {
  const level = nextLevel(check, state.level);
  if (RANK[level] <= RANK[state.level]) return { state: { ...state, level }, alert: false };
  const last = state.alertedAt[level];
  if (last !== undefined && now - last < REPEAT_AFTER_MS) return { state: { ...state, level }, alert: false };
  return { state: { level, alertedAt: { ...state.alertedAt, [level]: now } }, alert: true };
}
