import {
  ForecastPoint,
  fetchForecasts,
  forecastBatches,
  forecastUrl,
  parseForecastResponse,
} from './forecast';

const point = (i: number, elevationM: number | null = 2000): ForecastPoint => ({
  latitude: 42 + i / 100,
  longitude: 44 + i / 100,
  elevationM,
});

/** One location as Open-Meteo answers it. */
const location = (date = '2026-11-21', temp = 5) => ({
  latitude: 42,
  longitude: 44,
  elevation: 2100,
  utc_offset_seconds: 14400,
  timezone: 'Asia/Tbilisi',
  hourly: {
    time: [`${date}T07:00`, `${date}T08:00`],
    temperature_2m: [temp, temp + 1],
    apparent_temperature: [temp - 2, temp - 1],
    precipitation: [0, 0.4],
    precipitation_probability: [10, 60],
    snowfall: [0, 0],
    weather_code: [1, 61],
    visibility: [24000, 8000],
    wind_gusts_10m: [20, 30],
    freezing_level_height: [3100, 3000],
  },
  daily: {
    time: [date],
    sunrise: [`${date}T07:40`],
    sunset: [`${date}T17:15`],
    uv_index_max: [2.5],
  },
});

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

describe('forecastUrl', () => {
  it('asks for several points at once, each at its height, for a week in local time', () => {
    const url = forecastUrl([point(0, 2100.4), point(1, 1850)]);
    expect(url).toContain('latitude=42.00000,42.01000');
    expect(url).toContain('longitude=44.00000,44.01000');
    expect(url).toContain('elevation=2100,1850');
    expect(url).toContain('timezone=auto');
    expect(url).toContain('forecast_days=7');
    expect(url).toContain(
      'hourly=temperature_2m,apparent_temperature,precipitation,precipitation_probability,snowfall,weather_code,visibility,wind_gusts_10m,freezing_level_height',
    );
    expect(url).toContain('daily=sunrise,sunset,uv_index_max');
  });

  it('leaves the height to Open-Meteo for points without one', () => {
    expect(forecastUrl([point(0, null), point(1, null)])).not.toContain(
      'elevation=',
    );
  });
});

describe('forecastBatches', () => {
  it('keeps points with and without a height apart, 50 at most per request', () => {
    const points = [
      ...Array.from({ length: 120 }, (_, i) => point(i)),
      point(200, null),
      point(201, null),
    ];
    const batches = forecastBatches(points);
    expect(batches.map((b) => b.length)).toEqual([50, 50, 20, 2]);
    expect(batches[3]).toEqual([120, 121]);
    expect(new Set(batches.flat()).size).toBe(points.length);
  });
});

describe('parseForecastResponse', () => {
  it('reads a list for several points, in their order', () => {
    const [a, b] = parseForecastResponse(
      [location('2026-11-21', 5), location('2026-11-21', -3)],
      2,
    );
    expect(a!.hours[0]).toEqual({
      time: '2026-11-21T07:00',
      tempC: 5,
      feelsC: 3,
      precipMm: 0,
      precipProbability: 10,
      snowCm: 0,
      weathercode: 1,
      visibilityM: 24000,
      gustKmh: 20,
      freezingLevelM: 3100,
    });
    expect(b!.hours[0].tempC).toBe(-3);
    expect(a!.days).toEqual([
      {
        date: '2026-11-21',
        sunrise: '2026-11-21T07:40',
        sunset: '2026-11-21T17:15',
        daylightSeconds: null,
        uvMax: 2.5,
      },
    ]);
    expect(a!.utcOffsetSeconds).toBe(14400);
    expect(a!.elevationM).toBe(2100);
  });

  it('reads a single object for one point, and has nothing for a missing one', () => {
    expect(parseForecastResponse(location(), 1)[0]!.hours).toHaveLength(2);
    expect(parseForecastResponse([location()], 2)[1]).toBeNull();
  });
});

describe('fetchForecasts', () => {
  it('fetches a request at a time with a pause between, with a generic user agent', async () => {
    const points = [
      ...Array.from({ length: 60 }, (_, i) => point(i)),
      point(100, null),
    ];
    const fetchFn = jest.fn((url: string) => {
      const count = new URL(url).searchParams
        .get('latitude')!
        .split(',').length;
      return Promise.resolve(
        ok(
          count === 1
            ? location()
            : Array.from({ length: count }, () => location()),
        ),
      );
    });
    const sleep = jest.fn(() => Promise.resolve());

    const result = await fetchForecasts(points, {
      fetchFn: fetchFn as unknown as typeof fetch,
      sleep,
    });

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
    const init = (fetchFn.mock.calls[0] as unknown[])[1] as RequestInit;
    const agent = (init.headers as Record<string, string>)['User-Agent'];
    expect(agent).toBeTruthy();
    expect(agent).not.toMatch(/kvali|georgia/i);
    expect(result.forecasts.every((f) => f !== null)).toBe(true);
    expect(result).toEqual(
      expect.objectContaining({ requests: 3, failed: 0, errors: [] }),
    );
  });

  it('carries on after a failed request, leaving its points without a forecast', async () => {
    const points = [point(0), point(1, null)];
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce(ok(location()));

    const result = await fetchForecasts(points, {
      fetchFn: fetchFn as unknown as typeof fetch,
      sleep: () => Promise.resolve(),
    });

    expect(result.forecasts[0]).toBeNull();
    expect(result.forecasts[1]).not.toBeNull();
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual(['HTTP 429']);
  });

  it('survives a network error', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('socket hang up'));
    const result = await fetchForecasts([point(0)], {
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.forecasts).toEqual([null]);
    expect(result.errors).toEqual(['socket hang up']);
  });
});
