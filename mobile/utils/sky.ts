/**
 * The night sky over a place: how dark it gets and when, the moon, and how good tonight is for
 * stars, from the forecast's cloud cover. Also the hour-by-hour strip of the forecast card.
 */
import type { HourForecast } from '../services/forecast';
import { localClock, moonAltitude, moonIllumination, MoonPhaseName, sunTimes } from './astronomy';

const HOUR_MS = 3_600_000;

/** Local noon of a date at the place, as an instant (for the sun and moon of that day). */
export function placeNoon(date: string, utcOffsetSeconds: number): Date {
  return new Date(Date.parse(`${date}T12:00:00Z`) - utcOffsetSeconds * 1000);
}

/** The instant of a forecast hour ("2026-11-20T21:00", local to the place). */
export function hourInstant(time: string, utcOffsetSeconds: number): Date {
  return new Date(Date.parse(`${time}:00Z`) - utcOffsetSeconds * 1000);
}

export type SkyRating = 'excellent' | 'good' | 'fair' | 'poor';

export interface NightSky {
  rating: SkyRating;
  /** 0 to 100. */
  score: number;
  /** "Clear sky, no moon". */
  reason: string;
  /** Full darkness at the place, local "19:05"–"05:40"; null where it never gets fully dark. */
  darkFrom: string | null;
  darkUntil: string | null;
  moonPhase: MoonPhaseName;
  /** How much of the moon is lit, %. */
  moonPercent: number;
  /** Average cloud over the dark hours, %; null when the forecast has no cloud cover. */
  cloudPercent: number | null;
}

function cloudWords(cloud: number): string {
  if (cloud < 20) return 'Clear sky';
  if (cloud < 50) return 'Partly cloudy';
  if (cloud < 80) return 'Mostly cloudy';
  return 'Overcast';
}

/**
 * Tonight's sky after the evening of `date`: the dark hours between dusk and dawn, their cloud,
 * and the moon while it is up during them. Null when the forecast does not cover that night.
 */
export function nightSky(
  date: string,
  hours: HourForecast[],
  latitude: number,
  longitude: number,
  utcOffsetSeconds: number,
): NightSky | null {
  const today = sunTimes(placeNoon(date, utcOffsetSeconds), latitude, longitude);
  const next = new Date(Date.parse(`${date}T12:00:00Z`) + 24 * HOUR_MS).toISOString().slice(0, 10);
  const tomorrow = sunTimes(placeNoon(next, utcOffsetSeconds), latitude, longitude);
  // Full darkness when there is any; in midsummer only nautical twilight, then the sun's own set
  const from = today.nightStart ?? today.civilDusk ?? today.sunset;
  const until = tomorrow.nightEnd ?? tomorrow.civilDawn ?? tomorrow.sunrise;
  if (!from || !until) return null;

  const night = hours.filter((h) => {
    const t = hourInstant(h.time, utcOffsetSeconds).getTime();
    return t >= from.getTime() - HOUR_MS / 2 && t < until.getTime();
  });
  if (night.length === 0) return null;

  const clouds = night.map((h) => h.cloudCover).filter((c): c is number => c != null);
  const cloudPercent = clouds.length ? clouds.reduce((a, b) => a + b, 0) / clouds.length : null;

  const middle = new Date((from.getTime() + until.getTime()) / 2);
  const moon = moonIllumination(middle);
  const moonUp = night.filter((h) => moonAltitude(hourInstant(h.time, utcOffsetSeconds), latitude, longitude) > 0).length;
  const moonUpShare = moonUp / night.length;
  const moonBrightness = moon.fraction * moonUpShare;

  const clearness = cloudPercent == null ? 0.5 : 1 - cloudPercent / 100;
  const score = Math.round(clearness * (1 - 0.7 * moonBrightness) * 100);
  const rating: SkyRating = score >= 70 ? 'excellent' : score >= 50 ? 'good' : score >= 30 ? 'fair' : 'poor';

  const moonPart =
    moon.fraction < 0.1 || moonUpShare < 0.2
      ? 'no moon'
      : moonUpShare >= 0.8
        ? `${Math.round(moon.fraction * 100)}% moon all night`
        : `${Math.round(moon.fraction * 100)}% moon part of the night`;
  const reason = cloudPercent == null ? `Cloud unknown, ${moonPart}` : `${cloudWords(cloudPercent)}, ${moonPart}`;

  return {
    rating,
    score,
    reason,
    darkFrom: today.nightStart ? localClock(today.nightStart, utcOffsetSeconds) : null,
    darkUntil: tomorrow.nightEnd ? localClock(tomorrow.nightEnd, utcOffsetSeconds) : null,
    moonPhase: moon.name,
    moonPercent: Math.round(moon.fraction * 100),
    cloudPercent: cloudPercent == null ? null : Math.round(cloudPercent),
  };
}

export const SKY_LABEL: Record<SkyRating, string> = {
  excellent: 'Great night for stars',
  good: 'Good night for stars',
  fair: 'So-so night for stars',
  poor: 'Poor night for stars',
};

export interface HourCell {
  /** Local "14". */
  hour: string;
  time: string;
  tempC: number | null;
  weathercode: number | null;
  precipProbability: number | null;
  gustKmh: number | null;
}

/**
 * The hourly strip: for today the next 24 hours from now, for another day its hours from 06:00
 * to 21:00.
 */
export function hourlyCells(
  hours: HourForecast[],
  date: string,
  isToday: boolean,
  utcOffsetSeconds: number,
  now = Date.now(),
): HourCell[] {
  let picked: HourForecast[];
  if (isToday) {
    const start = now - HOUR_MS; // the hour we are in
    picked = hours
      .filter((h) => {
        const t = hourInstant(h.time, utcOffsetSeconds).getTime();
        return t > start && t <= start + 24 * HOUR_MS;
      })
      .slice(0, 24);
  } else {
    picked = hours.filter((h) => {
      if (!h.time.startsWith(date)) return false;
      const hour = Number(h.time.slice(11, 13));
      return hour >= 6 && hour <= 21;
    });
  }
  return picked.map((h) => ({
    hour: h.time.slice(11, 13),
    time: h.time,
    tempC: h.tempC,
    weathercode: h.weathercode,
    precipProbability: h.precipProbability,
    gustKmh: h.gustKmh,
  }));
}
