/**
 * Sun and moon for a place: sunrise, golden hour and the dark of night; the moon's phase, how
 * much of it is lit, its height in the sky, and when it rises and sets. Pure maths from the
 * standard low-precision formulas (J2000 orbital elements, as published by Astronomy Answers):
 * accurate to a minute or two for the sun and a few minutes for the moon, plenty for planning
 * a hike, a photo or a night under the stars.
 */

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;
/** Obliquity of the ecliptic. */
const OBLIQUITY = RAD * 23.4397;
/** Mean distance to the sun, km (for the moon's phase angle). */
const SUN_DISTANCE_KM = 149_598_000;

const toJulian = (date: Date) => date.valueOf() / DAY_MS - 0.5 + J1970;
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * DAY_MS);
const toDays = (date: Date) => toJulian(date) - J2000;

function rightAscension(l: number, b: number): number {
  return Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY), Math.cos(l));
}

function declination(l: number, b: number): number {
  return Math.asin(Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l));
}

function altitudeOf(hourAngle: number, phi: number, dec: number): number {
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(hourAngle));
}

function siderealTime(d: number, lw: number): number {
  return RAD * (280.16 + 360.9856235 * d) - lw;
}

function solarMeanAnomaly(d: number): number {
  return RAD * (357.5291 + 0.98560028 * d);
}

function eclipticLongitude(m: number): number {
  const center = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
  const perihelion = RAD * 102.9372;
  return m + center + perihelion + Math.PI;
}

function sunCoords(d: number): { dec: number; ra: number } {
  const l = eclipticLongitude(solarMeanAnomaly(d));
  return { dec: declination(l, 0), ra: rightAscension(l, 0) };
}

/** The sun's height above the horizon, in degrees (negative below it). */
export function sunAltitude(date: Date, latitude: number, longitude: number): number {
  const lw = RAD * -longitude;
  const phi = RAD * latitude;
  const d = toDays(date);
  const c = sunCoords(d);
  return altitudeOf(siderealTime(d, lw) - c.ra, phi, c.dec) / RAD;
}

const J0 = 0.0009;
const julianCycle = (d: number, lw: number) => Math.round(d - J0 - lw / (2 * Math.PI));
const approxTransit = (ht: number, lw: number, n: number) => J0 + (ht + lw) / (2 * Math.PI) + n;
const solarTransitJ = (ds: number, m: number, l: number) => J2000 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);

export interface SunTimes {
  solarNoon: Date;
  sunrise: Date | null;
  sunset: Date | null;
  /** The sun 6° up: the end of the morning golden hour, the start of the evening one. */
  goldenMorningEnd: Date | null;
  goldenEveningStart: Date | null;
  /** The sun 6° down: civil twilight. */
  civilDawn: Date | null;
  civilDusk: Date | null;
  /** The sun 18° down: full darkness, for stars. */
  nightEnd: Date | null;
  nightStart: Date | null;
}

/** Sun times on the day of `date` (UTC day of the given instant's local noon is what matters). */
export function sunTimes(date: Date, latitude: number, longitude: number): SunTimes {
  const lw = RAD * -longitude;
  const phi = RAD * latitude;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const m = solarMeanAnomaly(ds);
  const l = eclipticLongitude(m);
  const dec = declination(l, 0);
  const jNoon = solarTransitJ(ds, m, l);

  const pair = (angle: number): [Date | null, Date | null] => {
    const h = angle * RAD;
    const cosW = (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
    if (cosW < -1 || cosW > 1) return [null, null]; // never that high, or never that low, today
    const w = Math.acos(cosW);
    const jSet = solarTransitJ(approxTransit(w, lw, n), m, l);
    const jRise = jNoon - (jSet - jNoon);
    return [fromJulian(jRise), fromJulian(jSet)];
  };

  const [sunrise, sunset] = pair(-0.833);
  const [goldenMorningEnd, goldenEveningStart] = pair(6);
  const [civilDawn, civilDusk] = pair(-6);
  const [nightEnd, nightStart] = pair(-18);
  return {
    solarNoon: fromJulian(jNoon),
    sunrise,
    sunset,
    goldenMorningEnd,
    goldenEveningStart,
    civilDawn,
    civilDusk,
    nightEnd,
    nightStart,
  };
}

function moonCoords(d: number): { ra: number; dec: number; dist: number } {
  const l = RAD * (218.316 + 13.176396 * d); // ecliptic longitude
  const m = RAD * (134.963 + 13.064993 * d); // mean anomaly
  const f = RAD * (93.272 + 13.22935 * d); // mean distance
  const lon = l + RAD * 6.289 * Math.sin(m);
  const lat = RAD * 5.128 * Math.sin(f);
  return { ra: rightAscension(lon, lat), dec: declination(lon, lat), dist: 385001 - 20905 * Math.cos(m) };
}

/** The moon's height above the horizon, in degrees, with refraction near the horizon. */
export function moonAltitude(date: Date, latitude: number, longitude: number): number {
  const lw = RAD * -longitude;
  const phi = RAD * latitude;
  const d = toDays(date);
  const c = moonCoords(d);
  const h = altitudeOf(siderealTime(d, lw) - c.ra, phi, c.dec);
  const refraction = h >= 0 ? (0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179))) : 0;
  return (h + refraction) / RAD;
}

export type MoonPhaseName =
  | 'New moon'
  | 'Waxing crescent'
  | 'First quarter'
  | 'Waxing gibbous'
  | 'Full moon'
  | 'Waning gibbous'
  | 'Last quarter'
  | 'Waning crescent';

export interface MoonIllumination {
  /** How much of the disc is lit, 0 to 1. */
  fraction: number;
  /** Where in its cycle: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
  phase: number;
  name: MoonPhaseName;
}

export function moonPhaseName(phase: number): MoonPhaseName {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.03 || p >= 0.97) return 'New moon';
  if (p < 0.22) return 'Waxing crescent';
  if (p < 0.28) return 'First quarter';
  if (p < 0.47) return 'Waxing gibbous';
  if (p < 0.53) return 'Full moon';
  if (p < 0.72) return 'Waning gibbous';
  if (p < 0.78) return 'Last quarter';
  return 'Waning crescent';
}

export function moonIllumination(date: Date): MoonIllumination {
  const d = toDays(date);
  const s = sunCoords(d);
  const m = moonCoords(d);
  const phi = Math.acos(
    Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra),
  );
  const inc = Math.atan2(SUN_DISTANCE_KM * Math.sin(phi), m.dist - SUN_DISTANCE_KM * Math.cos(phi));
  const angle = Math.atan2(
    Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra),
  );
  const fraction = (1 + Math.cos(inc)) / 2;
  const phase = 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI;
  return { fraction, phase, name: moonPhaseName(phase) };
}

/** Moon height just at rise or set: its radius and refraction. */
const MOON_HORIZON = 0.133;
/** Steps when searching a day for moonrise and moonset. */
const MOON_STEP_MS = 10 * 60 * 1000;

export interface MoonTimes {
  rise: Date | null;
  set: Date | null;
  /** Up, or down, the whole day. */
  alwaysUp: boolean;
  alwaysDown: boolean;
}

/** When the moon rises and sets within the 24 hours from `from`. */
export function moonTimes(from: Date, latitude: number, longitude: number): MoonTimes {
  let rise: Date | null = null;
  let set: Date | null = null;
  let previous = moonAltitude(from, latitude, longitude) - MOON_HORIZON;
  const startsUp = previous > 0;
  let everUp = startsUp;
  for (let t = from.getTime() + MOON_STEP_MS; t <= from.getTime() + DAY_MS; t += MOON_STEP_MS) {
    const now = moonAltitude(new Date(t), latitude, longitude) - MOON_HORIZON;
    if (now > 0) everUp = true;
    if (previous <= 0 && now > 0 && !rise) {
      // Straight line between the two steps: within a minute or so
      rise = new Date(t - MOON_STEP_MS + (MOON_STEP_MS * -previous) / (now - previous));
    } else if (previous > 0 && now <= 0 && !set) {
      set = new Date(t - MOON_STEP_MS + (MOON_STEP_MS * previous) / (previous - now));
    }
    previous = now;
  }
  return {
    rise,
    set,
    alwaysUp: !rise && !set && startsUp,
    alwaysDown: !rise && !set && !everUp,
  };
}

/** "07:42" in the place's own time, from its offset to UTC. */
export function localClock(date: Date | null, utcOffsetSeconds: number): string | null {
  if (!date) return null;
  const local = new Date(date.getTime() + utcOffsetSeconds * 1000);
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}
