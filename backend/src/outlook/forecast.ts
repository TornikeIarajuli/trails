/**
 * The 7-day mountain forecast for many trails at once, from Open-Meteo (free, no key; it
 * receives coordinates only). Up to 50 points per request, each at its own height so the
 * temperatures are corrected for altitude; parsed like the app's parseMountainForecast.
 */
import type { DayForecast, HourForecast, MountainForecast } from './verdict';

export interface ForecastPoint {
  latitude: number;
  longitude: number;
  /** Null: Open-Meteo uses its own terrain height for the point. */
  elevationM: number | null;
}

export const MAX_POINTS_PER_REQUEST = 50;
const PAUSE_BETWEEN_REQUESTS_MS = 1000;
const REQUEST_TIMEOUT_MS = 30_000;
const USER_AGENT = 'TrailOutlook/1.0 (daily mountain forecast)';
const API_URL = 'https://api.open-meteo.com/v1/forecast';

/** What the hiking verdict reads, and no more (Open-Meteo counts the variables). */
const HOURLY = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation',
  'precipitation_probability',
  'snowfall',
  'weather_code',
  'visibility',
  'wind_gusts_10m',
  'freezing_level_height',
];
const DAILY = ['sunrise', 'sunset', 'uv_index_max'];

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

const column = (block: any, key: string, i: number): unknown =>
  Array.isArray(block?.[key]) ? block[key][i] : undefined;

/** One request for these points. Heights are given for all of them or for none. */
export function forecastUrl(points: ForecastPoint[]): string {
  const heights = points.every((p) => p.elevationM != null);
  const params = [
    `latitude=${points.map((p) => p.latitude.toFixed(5)).join(',')}`,
    `longitude=${points.map((p) => p.longitude.toFixed(5)).join(',')}`,
    heights
      ? `elevation=${points.map((p) => Math.round(p.elevationM as number)).join(',')}`
      : null,
    `hourly=${HOURLY.join(',')}`,
    `daily=${DAILY.join(',')}`,
    'timezone=auto',
    'forecast_days=7',
  ].filter(Boolean);
  return `${API_URL}?${params.join('&')}`;
}

/**
 * The requests for `points`, as lists of indexes into it: at most 50 points each, and points
 * with a height never share a request with points without one.
 */
export function forecastBatches(
  points: ForecastPoint[],
  size = MAX_POINTS_PER_REQUEST,
): number[][] {
  const withHeight: number[] = [];
  const withoutHeight: number[] = [];
  points.forEach((p, i) =>
    (p.elevationM != null ? withHeight : withoutHeight).push(i),
  );
  const batches: number[][] = [];
  for (const group of [withHeight, withoutHeight]) {
    for (let i = 0; i < group.length; i += size) {
      batches.push(group.slice(i, i + size));
    }
  }
  return batches;
}

/** Open-Meteo's column-wise blocks → one object per hour and per day. Tolerates missing columns. */
export function parseMountainForecast(data: any): MountainForecast {
  const hourTimes: unknown[] = Array.isArray(data?.hourly?.time)
    ? data.hourly.time
    : [];
  const hours = hourTimes
    .map((time, i): HourForecast => {
      const h = data.hourly;
      return {
        time: String(time),
        tempC: num(column(h, 'temperature_2m', i)),
        feelsC: num(column(h, 'apparent_temperature', i)),
        precipMm: num(column(h, 'precipitation', i)),
        precipProbability: num(column(h, 'precipitation_probability', i)),
        snowCm: num(column(h, 'snowfall', i)),
        weathercode: num(column(h, 'weather_code', i)),
        visibilityM: num(column(h, 'visibility', i)),
        gustKmh: num(column(h, 'wind_gusts_10m', i)),
        freezingLevelM: num(column(h, 'freezing_level_height', i)),
      };
    })
    .filter((h) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(h.time));

  const dayDates: unknown[] = Array.isArray(data?.daily?.time)
    ? data.daily.time
    : [];
  const days = dayDates
    .map((date, i): DayForecast => {
      const d = data.daily;
      return {
        date: String(date),
        sunrise: text(column(d, 'sunrise', i)),
        sunset: text(column(d, 'sunset', i)),
        daylightSeconds: num(column(d, 'daylight_duration', i)),
        uvMax: num(column(d, 'uv_index_max', i)),
      };
    })
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date));

  return {
    elevationM: num(data?.elevation),
    utcOffsetSeconds: num(data?.utc_offset_seconds) ?? 0,
    days,
    hours,
  };
}

/**
 * One response for `count` points, in their order: a list for several points, a single
 * object for one. A missing entry is null.
 */
export function parseForecastResponse(
  data: unknown,
  count: number,
): (MountainForecast | null)[] {
  const list: unknown[] = Array.isArray(data) ? data : [data];
  return Array.from({ length: count }, (_, i) => {
    const item = list[i];
    return item && typeof item === 'object'
      ? parseMountainForecast(item)
      : null;
  });
}

export interface ForecastFetch {
  /** In the order of the points; null where its request failed. */
  forecasts: (MountainForecast | null)[];
  requests: number;
  failed: number;
  errors: string[];
}

/**
 * The forecasts for all `points`, a request at a time with a pause between them. A failed
 * request leaves its points without a forecast and the others carry on.
 */
export async function fetchForecasts(
  points: ForecastPoint[],
  options: {
    fetchFn?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<ForecastFetch> {
  const fetchFn = options.fetchFn ?? fetch;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const forecasts: (MountainForecast | null)[] = points.map(() => null);
  const batches = forecastBatches(points);
  const errors: string[] = [];

  for (const [n, batch] of batches.entries()) {
    if (n > 0) await sleep(PAUSE_BETWEEN_REQUESTS_MS);
    try {
      const response = await fetchFn(forecastUrl(batch.map((i) => points[i])), {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parsed = parseForecastResponse(await response.json(), batch.length);
      parsed.forEach((forecast, k) => {
        forecasts[batch[k]] = forecast;
      });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    forecasts,
    requests: batches.length,
    failed: errors.length,
    errors,
  };
}
