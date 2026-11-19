/**
 * Go, wait or skip: a plain answer per day from the mountain forecast at a trail's highest
 * point. One spoiler is enough (a storm after lunch, a gale on the ridge), but when the good
 * hours before or after it are long enough for the hike, the answer is "go early" or "go after".
 *
 * A port of the app's mobile/utils/trailVerdict.ts (judgeDay, neededHours and what they use),
 * so the daily outlook gives the answer the trail page gives. Keep the two in step: a change
 * to the rules there belongs here too, with its test case in verdict.spec.ts.
 */

export type Verdict = 'go' | 'wait' | 'skip';
export type Hazard =
  | 'storm'
  | 'gale'
  | 'snow'
  | 'rain'
  | 'fog'
  | 'cold'
  | 'heat';

export interface HourForecast {
  /** Local time at the trail, "2026-11-20T07:00". */
  time: string;
  tempC: number | null;
  feelsC: number | null;
  precipMm: number | null;
  precipProbability: number | null;
  snowCm: number | null;
  weathercode: number | null;
  visibilityM: number | null;
  windKmh?: number | null;
  gustKmh: number | null;
  /** Height of the 0 °C line. */
  freezingLevelM: number | null;
}

export interface DayForecast {
  /** Local date at the trail, YYYY-MM-DD. */
  date: string;
  /** Local times, "2026-11-20T07:57". */
  sunrise: string | null;
  sunset: string | null;
  daylightSeconds: number | null;
  uvMax: number | null;
}

export interface MountainForecast {
  /** The height the forecast is for. */
  elevationM: number | null;
  /** The trail's offset from UTC. */
  utcOffsetSeconds: number;
  days: DayForecast[];
  hours: HourForecast[];
}

/** Any of these spoils an hour of hiking on its own. */
export const BAD_HOUR = {
  stormCodes: [95, 96, 99],
  /** Hard to stand on a ridge. */
  gustKmh: 60,
  /** Moderate rain, per hour. */
  rainMm: 2,
  snowCm: 1,
  /** Hard to follow the path. */
  visibilityM: 300,
  feelsColdC: -20,
  feelsHotC: 35,
};

/**
 * Any of these over the day's daylight calls the day off, whatever the hours between: gales come
 * at any hour, and deep new snow or a soaking stays on the path. (A storm spell alone does not:
 * the good hours around it decide.)
 */
export const SEVERE_DAY = {
  gustKmh: 80,
  snowCm: 10,
  rainMm: 20,
  feelsColdC: -28,
};

/** Worth knowing, but no reason to stay home. */
export const NOTE = {
  gustKmh: 40,
  showerProbability: 50,
  showerMm: 0.2,
  visibilityM: 2000,
  feelsColdC: -10,
  uvVeryHigh: 8,
};

/** Most important first: it names the day. */
const HAZARD_ORDER: Hazard[] = [
  'storm',
  'gale',
  'snow',
  'rain',
  'fog',
  'cold',
  'heat',
];

/**
 * Hours a hazard must last to spoil the day. Storms, gales and snow count from the first hour;
 * an hour of cloud, a shower or a cold spell is only worth a note.
 */
const SPOILS_AFTER_HOURS: Record<Hazard, number> = {
  storm: 1,
  gale: 1,
  snow: 1,
  rain: 2,
  fog: 2,
  cold: 2,
  heat: 2,
};

/** Feels this warm or more: a note about the heat. */
const HOT_NOTE_C = 30;

export interface DayVerdict {
  date: string;
  verdict: Verdict;
  /** "Go", "Go early", "Go after 11:00", "Go 10:00–15:00", "Wait", "Skip". */
  label: string;
  headline: string;
  /** The longest run of good hours when part of the day is spoiled; end is exclusive. */
  window: { start: string; end: string } | null;
  notes: string[];
  /** The worst weather of the daylight hours. */
  weathercode: number | null;
  /** At the forecast height, over the daylight hours. */
  tempMinC: number | null;
  tempMaxC: number | null;
  gustMaxKmh: number | null;
  precipMm: number;
  snowCm: number;
  /** Local "07:57". */
  sunrise: string | null;
  sunset: string | null;
  daylightSeconds: number | null;
  uvMax: number | null;
}

export interface VerdictTrail {
  /** Hours of walking the hike needs in one day. */
  neededHours: number;
  /** The highest point, for the freezing level. */
  topM: number | null;
}

const hourOf = (time: string) => Number(time.slice(11, 13));
const clock = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const timeOf = (iso: string | null) =>
  iso && /T\d{2}:\d{2}/.test(iso) ? iso.slice(11, 16) : null;
const minutesOf = (iso: string | null) => {
  const t = timeOf(iso);
  return t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null;
};
const values = (
  hours: HourForecast[],
  pick: (h: HourForecast) => number | null,
) => hours.map(pick).filter((v): v is number => v != null);
const maxOf = (list: number[]) => (list.length ? Math.max(...list) : null);
const minOf = (list: number[]) => (list.length ? Math.min(...list) : null);
const sumOf = (list: number[]) => list.reduce((a, b) => a + b, 0);
/** Whole degrees, never "-0°". */
export const degrees = (c: number) => `${Math.round(c) || 0}°`;
const thousands = (n: number) => n.toLocaleString('en-US');

/** Hours of walking for one day of the hike: the trail's estimate, one day of a multi-day trek. */
export function neededHours(trail: {
  estimated_hours?: number | null;
  distance_km?: number | null;
  elevation_gain_m?: number | null;
}): number {
  const estimate =
    trail.estimated_hours ??
    (trail.distance_km != null
      ? trail.distance_km / 4 + (trail.elevation_gain_m ?? 0) / 600
      : null) ??
    4;
  const oneDay = estimate > 10 ? 8 : estimate;
  return Math.min(9, Math.max(2, Math.ceil(oneDay)));
}

/** A day's hours between sunrise and sunset, when people hike; 07:00 to 19:00 without sun times. */
export function daylightHours(
  day: DayForecast,
  hours: HourForecast[],
): HourForecast[] {
  const rise = minutesOf(day.sunrise) ?? 7 * 60;
  const set = minutesOf(day.sunset) ?? 19 * 60;
  return hours.filter((h) => {
    if (!h.time.startsWith(day.date)) return false;
    const start = hourOf(h.time) * 60;
    return start >= rise - 30 && start + 60 <= set + 30;
  });
}

export function hazardsOf(h: HourForecast): Hazard[] {
  const out: Hazard[] = [];
  if (h.weathercode != null && BAD_HOUR.stormCodes.includes(h.weathercode))
    out.push('storm');
  if ((h.gustKmh ?? 0) >= BAD_HOUR.gustKmh) out.push('gale');
  if ((h.snowCm ?? 0) >= BAD_HOUR.snowCm) out.push('snow');
  else if ((h.precipMm ?? 0) >= BAD_HOUR.rainMm) out.push('rain');
  if (h.visibilityM != null && h.visibilityM < BAD_HOUR.visibilityM)
    out.push('fog');
  if (h.feelsC != null && h.feelsC <= BAD_HOUR.feelsColdC) out.push('cold');
  if (h.feelsC != null && h.feelsC >= BAD_HOUR.feelsHotC) out.push('heat');
  return out;
}

/** "from 14:00", "until 11:00", "12:00–16:00", "all day" or "on and off all day". */
function timing(hazardHours: number[], dayHours: number[]): string {
  const first = hazardHours[0];
  const last = hazardHours[hazardHours.length - 1];
  const dayFirst = dayHours[0];
  const dayLast = dayHours[dayHours.length - 1];
  if (first <= dayFirst && last >= dayLast) {
    return hazardHours.length >= dayHours.length
      ? 'all day'
      : 'on and off all day';
  }
  if (first <= dayFirst) return `until ${clock(last + 1)}`;
  if (last >= dayLast) return `from ${clock(first)}`;
  return `${clock(first)}–${clock(last + 1)}`;
}

/** Hours with any of it at all: the timing for a day that adds up to a lot in small amounts. */
const ANY_OF: Record<Hazard, (h: HourForecast) => boolean> = {
  storm: (h) => h.weathercode != null && h.weathercode >= 95,
  gale: (h) => (h.gustKmh ?? 0) >= NOTE.gustKmh,
  snow: (h) => (h.snowCm ?? 0) > 0,
  rain: (h) => (h.precipMm ?? 0) > 0,
  fog: (h) => h.visibilityM != null && h.visibilityM < NOTE.visibilityM,
  cold: (h) => h.feelsC != null && h.feelsC <= NOTE.feelsColdC,
  heat: (h) => h.feelsC != null && h.feelsC >= HOT_NOTE_C,
};

function describe(hazard: Hazard, daylight: HourForecast[]): string {
  const strict = daylight.filter((h) => hazardsOf(h).includes(hazard));
  const loose = daylight.filter(ANY_OF[hazard]);
  const hit = strict.length ? strict : loose.length ? loose : daylight;
  const when = timing(
    hit.map((h) => hourOf(h.time)),
    daylight.map((h) => hourOf(h.time)),
  );
  switch (hazard) {
    case 'storm':
      return `Thunderstorms likely ${when}`;
    case 'gale':
      return `Gusts up to ${Math.round(maxOf(values(hit, (h) => h.gustKmh)) ?? 0)} km/h at the top ${when}`;
    case 'snow':
      return `Snow ${when}, about ${Math.max(1, Math.round(sumOf(values(daylight, (h) => h.snowCm))))} cm`;
    case 'rain':
      return `Rain ${when}, about ${Math.max(1, Math.round(sumOf(values(daylight, (h) => h.precipMm))))} mm`;
    case 'fog':
      return `Thick cloud on the tops ${when}`;
    case 'cold':
      return `Feels like ${degrees(minOf(values(hit, (h) => h.feelsC)) ?? 0)} at the top ${when}`;
    case 'heat':
      return `Feels like ${degrees(maxOf(values(hit, (h) => h.feelsC)) ?? 0)} ${when}`;
  }
}

/** The longest run of consecutive hours without a spoiler: [first, last] hour, or null. */
function longestGoodRun(
  daylight: HourForecast[],
  spoiled: Set<number>,
): [number, number] | null {
  let best: [number, number] | null = null;
  let start: number | null = null;
  let previous: number | null = null;
  for (const h of daylight) {
    const hour = hourOf(h.time);
    if (spoiled.has(hour)) {
      start = null;
    } else {
      if (start === null || previous === null || hour !== previous + 1)
        start = hour;
      if (!best || hour - start > best[1] - best[0]) best = [start, hour];
    }
    previous = hour;
  }
  return best;
}

/** The verdict for one day; null when the forecast has no hours for it. */
export function judgeDay(
  day: DayForecast,
  hours: HourForecast[],
  trail: VerdictTrail,
): DayVerdict | null {
  const daylight = daylightHours(day, hours);
  if (daylight.length === 0) return null;

  const gustMax = maxOf(values(daylight, (h) => h.gustKmh));
  const feelsMin = minOf(values(daylight, (h) => h.feelsC));
  const snowCm = sumOf(values(daylight, (h) => h.snowCm));
  const precipMm = sumOf(values(daylight, (h) => h.precipMm));

  const base = {
    date: day.date,
    weathercode: maxOf(values(daylight, (h) => h.weathercode)),
    tempMinC: minOf(values(daylight, (h) => h.tempC)),
    tempMaxC: maxOf(values(daylight, (h) => h.tempC)),
    gustMaxKmh: gustMax,
    precipMm,
    snowCm,
    sunrise: timeOf(day.sunrise),
    sunset: timeOf(day.sunset),
    daylightSeconds: day.daylightSeconds,
    uvMax: day.uvMax,
  };

  // Hazards that last long enough to count, and the hours they spoil
  const hazardHours = new Map<Hazard, number[]>();
  daylight.forEach((h) => {
    hazardsOf(h).forEach((k) =>
      hazardHours.set(k, [...(hazardHours.get(k) ?? []), hourOf(h.time)]),
    );
  });
  const present = new Set<Hazard>(
    HAZARD_ORDER.filter(
      (k) => (hazardHours.get(k)?.length ?? 0) >= SPOILS_AFTER_HOURS[k],
    ),
  );
  const spoiled = new Set<number>(
    [...present].flatMap((k) => hazardHours.get(k) ?? []),
  );
  const feelsMax = maxOf(values(daylight, (h) => h.feelsC));

  // Worth knowing even on a good day
  const notes: string[] = [];
  if (
    !present.has('rain') &&
    !present.has('snow') &&
    !present.has('storm') &&
    daylight.some(
      (h) =>
        (h.precipProbability ?? 0) >= NOTE.showerProbability &&
        (h.precipMm ?? 0) >= NOTE.showerMm,
    )
  ) {
    notes.push('Showers possible');
  }
  if (!present.has('gale') && gustMax != null && gustMax >= NOTE.gustKmh) {
    notes.push(`Windy at the top, gusts to ${Math.round(gustMax)} km/h`);
  }
  if (
    !present.has('fog') &&
    daylight.some(
      (h) => h.visibilityM != null && h.visibilityM < NOTE.visibilityM,
    )
  ) {
    notes.push('Cloud may hide the views');
  }
  if (!present.has('cold') && feelsMin != null && feelsMin <= NOTE.feelsColdC) {
    notes.push(`Bitter cold at the top: feels like ${degrees(feelsMin)}`);
  }
  if (!present.has('heat') && feelsMax != null && feelsMax >= HOT_NOTE_C)
    notes.push(`Hot: feels like ${degrees(feelsMax)}`);
  const freezing = minOf(values(daylight, (h) => h.freezingLevelM));
  if (
    trail.topM != null &&
    freezing != null &&
    freezing < trail.topM - 100 &&
    !present.has('snow')
  ) {
    notes.push(
      `Freezing above ${thousands(Math.max(0, Math.round(freezing / 100) * 100))} m: ice or snow likely up high`,
    );
  }
  if (day.uvMax != null && day.uvMax >= NOTE.uvVeryHigh)
    notes.push(`Very strong sun (UV ${Math.round(day.uvMax)})`);

  // Calls the day off whatever the hours between
  let severe: Hazard | null = null;
  if (gustMax != null && gustMax >= SEVERE_DAY.gustKmh) severe = 'gale';
  else if (snowCm >= SEVERE_DAY.snowCm) severe = 'snow';
  else if (precipMm >= SEVERE_DAY.rainMm && present.has('rain'))
    severe = 'rain';
  else if (feelsMin != null && feelsMin <= SEVERE_DAY.feelsColdC)
    severe = 'cold';
  if (severe) {
    const others = HAZARD_ORDER.filter(
      (k) => present.has(k) && k !== severe,
    ).map((k) => describe(k, daylight));
    return {
      ...base,
      verdict: 'skip',
      label: 'Skip',
      headline: describe(severe, daylight),
      window: null,
      notes: [...others, ...notes],
    };
  }

  if (spoiled.size === 0) {
    return {
      ...base,
      verdict: 'go',
      label: 'Go',
      headline: notes.length ? 'Fine overall' : 'Dry and calm',
      window: null,
      notes,
    };
  }

  // The worst hazard names the day; any others come first among the notes
  const [main, ...others] = HAZARD_ORDER.filter((k) => present.has(k));
  const headline = describe(main, daylight);
  notes.unshift(...others.map((k) => describe(k, daylight)));
  const run = longestGoodRun(daylight, spoiled);
  const window = run ? { start: clock(run[0]), end: clock(run[1] + 1) } : null;
  const runHours = run ? run[1] - run[0] + 1 : 0;

  // Long enough for the hike with an hour to spare: go, in that window
  if (run && window && runHours >= trail.neededHours + 1) {
    const first = hourOf(daylight[0].time);
    const last = hourOf(daylight[daylight.length - 1].time);
    const label =
      run[0] <= first
        ? 'Go early'
        : run[1] >= last
          ? `Go after ${clock(run[0])}`
          : `Go ${window.start}–${window.end}`;
    return { ...base, verdict: 'go', label, headline, window, notes };
  }

  const verdict: Verdict =
    spoiled.size * 2 <= daylight.length ? 'wait' : 'skip';
  return {
    ...base,
    verdict,
    label: verdict === 'wait' ? 'Wait' : 'Skip',
    headline,
    window,
    notes,
  };
}
