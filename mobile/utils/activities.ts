/**
 * Go, wait or skip for each activity, from the same forecast: each looks at what matters to
 * it. Camping: the night (storms, wind on the tent, rain, cold) and fire risk. Fishing: the
 * hours fish feed (dawn, dusk, moonrise and moonset), the barometer, wind on the water.
 * Photography: the light at golden hour and the clouds that colour it. Stars: dark, clear,
 * moonless hours. 4×4: rain and snow over the last two days (mud, rivers). Running: the most
 * comfortable two hours. Climbing: an alpine start until 14:00, gales, new snow, cold.
 * Hiking is the trail verdict itself. Pure functions; the forecast card shows the result.
 */
import type { DayForecast, HourForecast, MountainForecast } from '../services/forecast';
import { DayVerdict, Verdict, degrees, judgeDay, judgeForecast, localNow } from './trailVerdict';
import { localClock, moonTimes, sunTimes } from './astronomy';
import { SKY_LABEL, hourInstant, nightSky, placeNoon } from './sky';

export type Activity = 'hiking' | 'camping' | 'fishing' | 'photography' | 'stargazing' | 'offroad' | 'running' | 'alpinism';

export const ACTIVITIES: { key: Activity; label: string; icon: string }[] = [
  { key: 'hiking', label: 'Hiking', icon: 'walk-outline' },
  { key: 'camping', label: 'Camping', icon: 'tent' },
  { key: 'fishing', label: 'Fishing', icon: 'fish-outline' },
  { key: 'photography', label: 'Photo', icon: 'camera-outline' },
  { key: 'stargazing', label: 'Stars', icon: 'moon-outline' },
  { key: 'offroad', label: '4×4', icon: 'car-outline' },
  { key: 'running', label: 'Running', icon: 'footsteps-outline' },
  { key: 'alpinism', label: 'Climbing', icon: 'mountain-snow' },
];

export interface ActivityContext {
  /** Hours of walking the hike needs in a day. */
  neededHours: number;
  /** The highest point (freezing level); null when unknown. */
  topM: number | null;
  latitude: number;
  longitude: number;
  /** River crossings without a bridge on the way (4×4). */
  fords?: number;
}

const HOUR_MS = 3_600_000;
const STORM_CODES = new Set([95, 96, 99]);

const sum = (list: (number | null | undefined)[]) => list.reduce<number>((a, b) => a + (b ?? 0), 0);
const max = (list: (number | null | undefined)[]) => {
  const v = list.filter((x): x is number => x != null);
  return v.length ? Math.max(...v) : null;
};
const min = (list: (number | null | undefined)[]) => {
  const v = list.filter((x): x is number => x != null);
  return v.length ? Math.min(...v) : null;
};
const avg = (list: (number | null | undefined)[]) => {
  const v = list.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const hasStorm = (hours: HourForecast[]) => hours.some((h) => h.weathercode != null && STORM_CODES.has(h.weathercode));
const labelFor = (v: Verdict) => (v === 'go' ? 'Go' : v === 'wait' ? 'Wait' : 'Skip');
const clockOf = (hour: number) => `${String(((hour % 24) + 24) % 24).padStart(2, '0')}:00`;

/** The forecast hours between two instants. */
function between(hours: HourForecast[], from: number, until: number, offset: number): HourForecast[] {
  return hours.filter((h) => {
    const t = hourInstant(h.time, offset).getTime();
    return t >= from && t < until;
  });
}

/** An instant at a local clock time of a date at the place. */
function at(date: string, hour: number, offset: number): number {
  return Date.parse(`${date}T00:00:00Z`) + hour * HOUR_MS - offset * 1000;
}

function result(
  base: DayVerdict,
  verdict: Verdict,
  headline: string,
  notes: string[],
  highlights: { label: string; value: string }[],
  window: DayVerdict['window'] = null,
  label = labelFor(verdict),
): DayVerdict {
  return { ...base, verdict, label, headline, notes, highlights, window };
}

function camping(day: DayForecast, f: MountainForecast, base: DayVerdict): DayVerdict {
  const off = f.utcOffsetSeconds;
  const night = between(f.hours, at(day.date, 18, off), at(day.date, 33, off), off);
  const gust = max(night.map((h) => h.gustKmh)) ?? 0;
  const rain = sum(night.map((h) => h.precipMm));
  const snow = sum(night.map((h) => h.snowCm));
  const low = min(night.map((h) => h.tempC));
  const feelsLow = min(night.map((h) => h.feelsC));
  const before = between(f.hours, at(day.date, -48, off), at(day.date, 18, off), off);
  const dry = sum(before.map((h) => h.precipMm)) < 1;
  const dayGust = base.gustMaxKmh ?? 0;
  const fire = (base.tempMaxC ?? 0) >= 27 && dry && dayGust >= 25 ? 'high' : (base.tempMaxC ?? 0) >= 24 && dry ? 'moderate' : null;

  let verdict: Verdict = 'go';
  let headline = low != null ? `Calm, dry night, low ${degrees(low)}` : 'Calm, dry night';
  if (hasStorm(night)) {
    verdict = 'skip';
    headline = 'Thunderstorms in the night';
  } else if (gust >= 60 || rain >= 10 || snow >= 5) {
    verdict = 'skip';
    headline = gust >= 60 ? `Gusts up to ${Math.round(gust)} km/h tonight` : snow >= 5 ? `Snow tonight, about ${Math.round(snow)} cm` : `Rain tonight, about ${Math.round(rain)} mm`;
  } else if (gust >= 40 || rain >= 2 || snow >= 1 || (feelsLow != null && feelsLow <= -10)) {
    verdict = 'wait';
    headline =
      gust >= 40
        ? `Windy night: gusts to ${Math.round(gust)} km/h`
        : snow >= 1
          ? `Some snow tonight, about ${Math.max(1, Math.round(snow))} cm`
          : rain >= 2
            ? `Rain tonight, about ${Math.round(rain)} mm`
            : `Freezing night: feels like ${degrees(feelsLow!)}`;
  }

  const notes: string[] = [];
  if (fire === 'high') notes.push('High fire risk: hot, dry and windy. No open fires.');
  else if (fire === 'moderate') notes.push('Dry spell: keep any fire small and watched');
  if (low != null && low <= 0 && verdict === 'go') notes.push('Below freezing at night: a warm sleeping bag');

  const highlights = [
    ...(low != null ? [{ label: 'Night low', value: degrees(low) }] : []),
    ...(base.sunset ? [{ label: 'Sunset', value: base.sunset }] : []),
    { label: 'Wind tonight', value: `${Math.round(gust)} km/h` },
  ];
  return result(base, verdict, headline, notes, highlights);
}

interface Span {
  start: number;
  end: number;
  strength: number;
}

/** Merges overlapping spans, adding up their strength. */
function merge(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
      last.strength += s.strength;
    } else out.push({ ...s });
  }
  return out;
}

function fishing(day: DayForecast, f: MountainForecast, base: DayVerdict, ctx: ActivityContext): DayVerdict {
  const off = f.utcOffsetSeconds;
  const noon = placeNoon(day.date, off);
  const sun = sunTimes(noon, ctx.latitude, ctx.longitude);
  const moon = moonTimes(new Date(at(day.date, 0, off)), ctx.latitude, ctx.longitude);
  const spans: Span[] = [];
  if (sun.sunrise) spans.push({ start: sun.sunrise.getTime() - HOUR_MS, end: sun.sunrise.getTime() + HOUR_MS, strength: 2 });
  if (sun.sunset) spans.push({ start: sun.sunset.getTime() - HOUR_MS, end: sun.sunset.getTime() + HOUR_MS, strength: 2 });
  const fishingHours = (t: number) => t >= at(day.date, 4, off) && t <= at(day.date, 22, off);
  for (const event of [moon.rise, moon.set]) {
    if (event && fishingHours(event.getTime())) {
      spans.push({ start: event.getTime() - HOUR_MS, end: event.getTime() + HOUR_MS, strength: 1 });
    }
  }
  const windows = merge(spans)
    .sort((a, b) => b.strength - a.strength || a.start - b.start)
    .slice(0, 3)
    .sort((a, b) => a.start - b.start)
    .map((s) => `${localClock(new Date(s.start), off)}–${localClock(new Date(s.end), off)}`);

  const daylight = between(f.hours, at(day.date, 5, off), at(day.date, 21, off), off);
  const gust = max(daylight.map((h) => h.gustKmh)) ?? 0;
  const rain = sum(daylight.map((h) => h.precipMm));
  const morning = daylight.find((h) => h.time.endsWith('06:00'))?.pressureHpa ?? null;
  const evening = daylight.find((h) => h.time.endsWith('18:00'))?.pressureHpa ?? null;

  let verdict: Verdict = 'go';
  let headline = windows.length ? `Best bite ${windows.slice(0, 2).join(' and ')}` : 'Fish at dawn and dusk';
  if (hasStorm(daylight)) {
    verdict = 'skip';
    headline = 'Thunderstorms: stay off the water';
  } else if (gust >= 50) {
    verdict = 'skip';
    headline = `Gusts up to ${Math.round(gust)} km/h on the water`;
  } else if (gust >= 30 || rain >= 10) {
    verdict = 'wait';
    headline = gust >= 30 ? `Windy: gusts to ${Math.round(gust)} km/h make casting hard` : `Heavy rain, about ${Math.round(rain)} mm`;
  }

  const notes: string[] = [];
  if (morning != null && evening != null) {
    if (evening - morning <= -2) notes.push('Falling pressure: fish often feed before a change in the weather');
    else if (evening - morning >= 3) notes.push('Rising pressure after a front: the bite can be slow');
  }
  const highlights = windows.length ? [{ label: 'Bite windows', value: windows.join(', ') }] : [];
  return result(base, verdict, headline, notes, highlights);
}

type Light = 'clear' | 'colour' | 'dull' | 'overcast' | 'rain';

function lightAt(hours: HourForecast[]): Light | null {
  if (hours.length === 0) return null;
  if (hasStorm(hours) || sum(hours.map((h) => h.precipMm)) >= 0.5) return 'rain';
  const cloud = avg(hours.map((h) => h.cloudCover));
  if (cloud == null) return null;
  if (cloud < 20) return 'clear';
  if (cloud < 70) return 'colour';
  if (cloud < 90) return 'dull';
  return 'overcast';
}

const LIGHT_WORDS: Record<Light, string> = {
  clear: 'clean light',
  colour: 'good chance of colour in the clouds',
  dull: 'mostly cloudy, little colour',
  overcast: 'overcast, soft light',
  rain: 'rain',
};

function photography(day: DayForecast, f: MountainForecast, base: DayVerdict, ctx: ActivityContext): DayVerdict {
  const off = f.utcOffsetSeconds;
  const sun = sunTimes(placeNoon(day.date, off), ctx.latitude, ctx.longitude);
  const morningSpan = sun.sunrise && sun.goldenMorningEnd ? [sun.sunrise, sun.goldenMorningEnd] : null;
  const eveningSpan = sun.goldenEveningStart && sun.sunset ? [sun.goldenEveningStart, sun.sunset] : null;
  const around = (span: Date[] | null) =>
    span ? between(f.hours, span[0].getTime() - HOUR_MS, span[1].getTime() + HOUR_MS / 2, off) : [];
  const morning = lightAt(around(morningSpan));
  const evening = lightAt(around(eveningSpan));
  const span = (s: Date[] | null) => (s ? `${localClock(s[0], off)}–${localClock(s[1], off)}` : null);
  const good = (l: Light | null) => l === 'clear' || l === 'colour';

  let verdict: Verdict;
  let headline: string;
  if (good(evening) && eveningSpan) {
    verdict = 'go';
    headline = `Golden hour ${span(eveningSpan)}: ${LIGHT_WORDS[evening!]}`;
  } else if (good(morning) && morningSpan) {
    verdict = 'go';
    headline = `Morning golden hour ${span(morningSpan)}: ${LIGHT_WORDS[morning!]}`;
  } else if ((evening === 'rain' || evening === 'overcast') && (morning === 'rain' || morning === 'overcast')) {
    verdict = hasStorm(between(f.hours, at(day.date, 6, off), at(day.date, 20, off), off)) ? 'skip' : 'wait';
    headline = evening === 'rain' ? 'Rain at golden hour' : 'Overcast at golden hour';
  } else if (evening == null && morning == null) {
    verdict = 'wait';
    headline = eveningSpan ? `Golden hour ${span(eveningSpan)}` : 'No golden hour forecast';
  } else {
    verdict = 'wait';
    headline = `Golden hour ${span(eveningSpan) ?? ''}: ${LIGHT_WORDS[evening ?? morning ?? 'dull']}`.replace(':  ', ': ');
  }

  const notes: string[] = [];
  const dawn = around(morningSpan);
  if (dawn.some((h) => h.visibilityM != null && h.visibilityM < 2000)) notes.push('Mist at sunrise: moody valleys');
  const highlights = [
    ...(morningSpan ? [{ label: 'Golden morning', value: span(morningSpan)! }] : []),
    ...(eveningSpan ? [{ label: 'Golden evening', value: span(eveningSpan)! }] : []),
    ...(sun.sunset && sun.civilDusk ? [{ label: 'Blue hour', value: `${localClock(sun.sunset, off)}–${localClock(sun.civilDusk, off)}` }] : []),
  ];
  return result(base, verdict, headline, notes, highlights);
}

function stargazing(day: DayForecast, f: MountainForecast, base: DayVerdict, ctx: ActivityContext): DayVerdict {
  const sky = nightSky(day.date, f.hours, ctx.latitude, ctx.longitude, f.utcOffsetSeconds);
  if (!sky) return result(base, 'wait', 'No forecast for that night yet', [], []);
  const verdict: Verdict = sky.rating === 'excellent' || sky.rating === 'good' ? 'go' : sky.rating === 'fair' ? 'wait' : 'skip';
  const off = f.utcOffsetSeconds;
  const night = between(f.hours, at(day.date, 20, off), at(day.date, 29, off), off);
  const feels = min(night.map((h) => h.feelsC));
  const notes = feels != null && feels <= 0 ? [`Cold night: feels like ${degrees(feels)}`] : [];
  const highlights = [
    ...(sky.darkFrom && sky.darkUntil ? [{ label: 'Dark', value: `${sky.darkFrom}–${sky.darkUntil}` }] : []),
    { label: 'Moon', value: `${sky.moonPhase}, ${sky.moonPercent}%` },
    ...(sky.cloudPercent != null ? [{ label: 'Cloud', value: `${sky.cloudPercent}%` }] : []),
  ];
  return result(base, verdict, `${SKY_LABEL[sky.rating]}: ${sky.reason.charAt(0).toLowerCase()}${sky.reason.slice(1)}`, notes, highlights);
}

function offroad(day: DayForecast, f: MountainForecast, base: DayVerdict, ctx: ActivityContext): DayVerdict {
  const off = f.utcOffsetSeconds;
  const morning = at(day.date, 6, off);
  const past = between(f.hours, morning - 48 * HOUR_MS, morning, off);
  const today = between(f.hours, morning, at(day.date, 19, off), off);
  const pastRain = sum(past.map((h) => h.precipMm));
  const dayRain = sum(today.map((h) => h.precipMm));
  const snow = sum([...past, ...today].map((h) => h.snowCm));
  const wet = pastRain + dayRain;
  const freezing = (min(today.map((h) => h.tempC)) ?? 5) <= 0;

  let verdict: Verdict = 'go';
  let headline = wet < 1 ? 'Dry tracks: no rain in the last two days' : `Tracks drying: ${Math.round(wet)} mm in two days`;
  if (hasStorm(today)) {
    verdict = 'skip';
    headline = 'Thunderstorms on the route';
  } else if (wet >= 20 || snow >= 10) {
    verdict = 'skip';
    headline = snow >= 10 ? `Deep snow likely: ${Math.round(snow)} cm in two days` : `Deep mud likely: ${Math.round(wet)} mm of rain in two days`;
  } else if (wet >= 8 || snow >= 3 || (freezing && wet >= 2)) {
    verdict = 'wait';
    headline = snow >= 3 ? `Snow on the tracks: ${Math.round(snow)} cm` : freezing ? 'Ice likely on wet tracks' : `Muddy: ${Math.round(wet)} mm of rain in two days`;
  }

  const notes: string[] = [];
  if ((ctx.fords ?? 0) > 0) {
    notes.push(
      pastRain >= 10
        ? `${ctx.fords} river crossings: high after the rain`
        : `${ctx.fords} river crossings without a bridge`,
    );
  }
  const highlights = [
    { label: 'Rain, last 48 h', value: `${Math.round(pastRain)} mm` },
    { label: 'Rain today', value: `${Math.round(dayRain)} mm` },
  ];
  return result(base, verdict, headline, notes, highlights);
}

/** How pleasant an hour is for a run: about 1 at its best, below 0 when it is not. */
function runComfort(h: HourForecast): number {
  if (h.weathercode != null && STORM_CODES.has(h.weathercode)) return -5;
  const feels = h.feelsC ?? h.tempC ?? 12;
  let score = 1;
  if (feels > 20) score -= (feels - 20) / 6;
  if (feels < 2) score -= (2 - feels) / 10;
  if ((h.precipMm ?? 0) >= 0.5) score -= 1;
  else if ((h.precipProbability ?? 0) >= 60) score -= 0.3;
  if ((h.gustKmh ?? 0) >= 40) score -= 0.5;
  return score;
}

function running(day: DayForecast, f: MountainForecast, base: DayVerdict, now: number): DayVerdict {
  const off = f.utcOffsetSeconds;
  // Today, only the hours still ahead (from the hour we are in)
  const from = Math.max(at(day.date, 6, off), now - HOUR_MS);
  const hours = between(f.hours, from, at(day.date, 22, off), off);
  let best: { start: number; score: number } | null = null;
  for (let i = 0; i + 1 < hours.length; i++) {
    const score = runComfort(hours[i]) + runComfort(hours[i + 1]);
    if (!best || score > best.score) best = { start: Number(hours[i].time.slice(11, 13)), score };
  }
  if (!best) {
    const late = now > at(day.date, 6, off);
    return result(base, 'wait', late ? 'Too late for a run today' : 'No forecast for the day yet', [], []);
  }
  const window = { start: clockOf(best.start), end: clockOf(best.start + 2) };
  const feelsMax = max(hours.map((h) => h.feelsC));
  const verdict: Verdict = best.score >= 1 ? 'go' : best.score >= -2 ? 'wait' : 'skip';
  const hot = feelsMax != null && feelsMax >= 28;
  const rainy = hours.filter((h) => (h.precipMm ?? 0) >= 0.5).length >= hours.length / 2;
  const headline =
    verdict === 'skip'
      ? hasStorm(hours)
        ? 'Thunderstorms all day'
        : rainy
          ? 'Rain most of the day'
          : hot
            ? `Too hot all day: feels like ${degrees(feelsMax!)}`
            : 'Poor weather for a run all day'
      : `Best time ${window.start}–${window.end}${hot && best.start < 11 ? ', before the heat' : ''}`;
  const notes: string[] = [];
  if (hot) notes.push(`Hot later: feels like ${degrees(feelsMax!)}`);
  if (base.uvMax != null && base.uvMax >= 7) notes.push(`Strong sun (UV ${Math.round(base.uvMax)}): cap and water`);
  return result(base, verdict, headline, notes, [{ label: 'Best 2 hours', value: `${window.start}–${window.end}` }], window);
}

function alpinism(day: DayForecast, f: MountainForecast, base: DayVerdict, ctx: ActivityContext): DayVerdict {
  const off = f.utcOffsetSeconds;
  const sun = sunTimes(placeNoon(day.date, off), ctx.latitude, ctx.longitude);
  const start = sun.sunrise ? sun.sunrise.getTime() - 2 * HOUR_MS : at(day.date, 5, off);
  const window = between(f.hours, start, at(day.date, 14, off), off);
  const past = between(f.hours, start - 48 * HOUR_MS, start, off);
  const gust = max(window.map((h) => h.gustKmh)) ?? 0;
  const feels = min(window.map((h) => h.feelsC));
  const newSnow = sum(past.map((h) => h.snowCm));
  const snowNow = sum(window.map((h) => h.snowCm));
  const foggy = window.filter((h) => h.visibilityM != null && h.visibilityM < 1000).length >= 2;
  const freezing = min(window.map((h) => h.freezingLevelM));

  let verdict: Verdict = 'go';
  let headline = `Settled until 14:00: start by ${localClock(new Date(start), off)}`;
  if (hasStorm(window)) {
    verdict = 'skip';
    headline = 'Thunderstorms before 14:00: no summit today';
  } else if (gust >= 70 || (feels != null && feels <= -25) || newSnow >= 20) {
    verdict = 'skip';
    headline =
      gust >= 70
        ? `Gusts up to ${Math.round(gust)} km/h at the top`
        : newSnow >= 20
          ? `Avalanche danger: ${Math.round(newSnow)} cm of new snow`
          : `Feels like ${degrees(feels!)} at the top`;
  } else if (gust >= 50 || newSnow >= 10 || snowNow >= 2 || foggy) {
    verdict = 'wait';
    headline =
      gust >= 50
        ? `Strong wind: gusts to ${Math.round(gust)} km/h`
        : newSnow >= 10
          ? `Fresh snow: ${Math.round(newSnow)} cm in two days`
          : snowNow >= 2
            ? 'Snowing on the climb'
            : 'Cloud on the top: little to see, hard to find the way';
  }

  const notes: string[] = [];
  if (freezing != null && ctx.topM != null) {
    notes.push(
      freezing < ctx.topM
        ? `Freezing above ${Math.round(freezing / 100) * 100} m: hard snow and ice, crampons and axe`
        : 'Above freezing to the top: snow softens by midday',
    );
  }
  const highlights = [
    ...(freezing != null ? [{ label: 'Freezing level', value: `${(Math.round(freezing / 100) * 100).toLocaleString('en-US')} m` }] : []),
    { label: 'Gusts by 14:00', value: `${Math.round(gust)} km/h` },
    { label: 'New snow, 48 h', value: `${Math.round(newSnow)} cm` },
  ];
  return result(base, verdict, headline, notes, highlights);
}

/** The verdicts for an activity, today and the days after (like judgeForecast for hiking). */
export function judgeActivity(
  activity: Activity,
  forecast: MountainForecast,
  ctx: ActivityContext,
  now = Date.now(),
): DayVerdict[] {
  const trail = { neededHours: ctx.neededHours, topM: ctx.topM };
  if (activity === 'hiking') return judgeForecast(forecast, trail, now);
  const today = localNow(forecast.utcOffsetSeconds, now).date;
  const out: DayVerdict[] = [];
  for (const day of forecast.days) {
    if (day.date < today) continue;
    const base = judgeDay(day, forecast.hours, trail);
    if (!base) continue;
    switch (activity) {
      case 'camping':
        out.push(camping(day, forecast, base));
        break;
      case 'fishing':
        out.push(fishing(day, forecast, base, ctx));
        break;
      case 'photography':
        out.push(photography(day, forecast, base, ctx));
        break;
      case 'stargazing':
        out.push(stargazing(day, forecast, base, ctx));
        break;
      case 'offroad':
        out.push(offroad(day, forecast, base, ctx));
        break;
      case 'running':
        out.push(running(day, forecast, base, now));
        break;
      case 'alpinism':
        out.push(alpinism(day, forecast, base, ctx));
        break;
    }
  }
  return out;
}
