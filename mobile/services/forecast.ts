/**
 * The 7-day mountain forecast for a trail, asked for at its highest point: that point's
 * coordinates, and its height so temperatures are corrected for altitude. Open-Meteo, free,
 * no key; it receives coordinates only.
 */

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
  windKmh: number | null;
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
  tempMaxC: number | null;
  tempMinC: number | null;
}

export interface CurrentConditions {
  time: string;
  tempC: number | null;
  feelsC: number | null;
  weathercode: number | null;
  windKmh: number | null;
  gustKmh: number | null;
}

export interface MountainForecast {
  /** When it was fetched (ms since 1970); a saved forecast says how old it is. */
  fetchedAt: number;
  /** The height the forecast is for. */
  elevationM: number | null;
  /** The trail's offset from UTC, for "today" and "now" at the trail. */
  utcOffsetSeconds: number;
  current: CurrentConditions | null;
  days: DayForecast[];
  hours: HourForecast[];
}

export interface ForecastPoint {
  latitude: number;
  longitude: number;
  /** Null: Open-Meteo uses its own terrain height for the point. */
  elevationM: number | null;
}

const HOURLY = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation',
  'precipitation_probability',
  'snowfall',
  'weather_code',
  'visibility',
  'wind_speed_10m',
  'wind_gusts_10m',
  'freezing_level_height',
];
const DAILY = ['sunrise', 'sunset', 'daylight_duration', 'uv_index_max', 'temperature_2m_max', 'temperature_2m_min'];
const CURRENT = ['temperature_2m', 'apparent_temperature', 'weather_code', 'wind_speed_10m', 'wind_gusts_10m'];

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

const column = (block: any, key: string, i: number) => (Array.isArray(block?.[key]) ? block[key][i] : undefined);

export function forecastUrl({ latitude, longitude, elevationM }: ForecastPoint): string {
  const params = [
    `latitude=${latitude.toFixed(5)}`,
    `longitude=${longitude.toFixed(5)}`,
    elevationM != null ? `elevation=${Math.round(elevationM)}` : null,
    `hourly=${HOURLY.join(',')}`,
    `daily=${DAILY.join(',')}`,
    `current=${CURRENT.join(',')}`,
    'timezone=auto',
    'forecast_days=7',
  ].filter(Boolean);
  return `https://api.open-meteo.com/v1/forecast?${params.join('&')}`;
}

/** Open-Meteo's column-wise blocks → one object per hour and per day. Tolerates missing columns. */
export function parseMountainForecast(data: any, fetchedAt: number): MountainForecast {
  const hourTimes: unknown[] = Array.isArray(data?.hourly?.time) ? data.hourly.time : [];
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
        windKmh: num(column(h, 'wind_speed_10m', i)),
        gustKmh: num(column(h, 'wind_gusts_10m', i)),
        freezingLevelM: num(column(h, 'freezing_level_height', i)),
      };
    })
    .filter((h) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(h.time));

  const dayDates: unknown[] = Array.isArray(data?.daily?.time) ? data.daily.time : [];
  const days = dayDates
    .map((date, i): DayForecast => {
      const d = data.daily;
      return {
        date: String(date),
        sunrise: text(column(d, 'sunrise', i)),
        sunset: text(column(d, 'sunset', i)),
        daylightSeconds: num(column(d, 'daylight_duration', i)),
        uvMax: num(column(d, 'uv_index_max', i)),
        tempMaxC: num(column(d, 'temperature_2m_max', i)),
        tempMinC: num(column(d, 'temperature_2m_min', i)),
      };
    })
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date));

  const c = data?.current;
  const current: CurrentConditions | null = text(c?.time)
    ? {
        time: c.time,
        tempC: num(c.temperature_2m),
        feelsC: num(c.apparent_temperature),
        weathercode: num(c.weather_code),
        windKmh: num(c.wind_speed_10m),
        gustKmh: num(c.wind_gusts_10m),
      }
    : null;

  return {
    fetchedAt,
    elevationM: num(data?.elevation),
    utcOffsetSeconds: num(data?.utc_offset_seconds) ?? 0,
    current,
    days,
    hours,
  };
}

export const forecastService = {
  async getMountainForecast(point: ForecastPoint): Promise<MountainForecast> {
    const response = await fetch(forecastUrl(point));
    if (!response.ok) throw new Error('Failed to fetch the forecast');
    return parseMountainForecast(await response.json(), Date.now());
  },
};
