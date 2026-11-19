import { forecastUrl, parseMountainForecast } from '../../services/forecast';

describe('forecastUrl', () => {
  it('asks at the point and its height, for 7 days in the trail’s own time zone', () => {
    const url = forecastUrl({ latitude: 42.517, longitude: 44.683, elevationM: 3338.4 });
    expect(url).toContain('latitude=42.51700&longitude=44.68300&elevation=3338&');
    expect(url).toContain('forecast_days=7');
    // The last two days too: rain that fell yesterday still makes tracks muddy
    expect(url).toContain('past_days=2');
    expect(url).toMatch(/hourly=[^&]*cloud_cover[^&]*surface_pressure/);
    expect(url).toContain('timezone=auto');
    expect(url).toMatch(/hourly=[^&]*wind_gusts_10m[^&]*freezing_level_height/);
    expect(url).toMatch(/daily=sunrise,sunset,daylight_duration,uv_index_max/);
  });

  it("lets Open-Meteo use its own terrain height when the trail's is unknown", () => {
    expect(forecastUrl({ latitude: 42, longitude: 44, elevationM: null })).not.toContain('elevation=');
  });
});

describe('parseMountainForecast', () => {
  const raw = {
    elevation: 3338,
    utc_offset_seconds: 14400,
    current: { time: '2026-11-19T23:15', temperature_2m: -6.3, apparent_temperature: -11.1, weather_code: 77, wind_speed_10m: 12.8, wind_gusts_10m: 54 },
    hourly: {
      time: ['2026-11-20T07:00', '2026-11-20T08:00', 'bad'],
      temperature_2m: [-8.2, -7.9, 0],
      apparent_temperature: [-13, -12.7, 0],
      precipitation: [0, 0.4, 0],
      precipitation_probability: [0, 60, 0],
      snowfall: [0, 0.3, 0],
      weather_code: [0, 71, 0],
      visibility: [41000, 900, 0],
      wind_speed_10m: [8.5, 7.7, 0],
      wind_gusts_10m: [27, 33, 0],
      // freezing_level_height missing: tolerated
    },
    daily: {
      time: ['2026-11-20'],
      sunrise: ['2026-11-20T07:57'],
      sunset: ['2026-11-20T17:34'],
      daylight_duration: [34603.8],
      uv_index_max: [3.45],
      temperature_2m_max: [-4.3],
      temperature_2m_min: [-8.5],
    },
  };

  it('turns the columns into hours and days, keeping only well-formed times', () => {
    const f = parseMountainForecast(raw, 1000);
    expect(f.fetchedAt).toBe(1000);
    expect(f.elevationM).toBe(3338);
    expect(f.utcOffsetSeconds).toBe(14400);
    expect(f.hours).toHaveLength(2);
    expect(f.hours[1]).toEqual({
      time: '2026-11-20T08:00',
      tempC: -7.9,
      feelsC: -12.7,
      precipMm: 0.4,
      precipProbability: 60,
      snowCm: 0.3,
      weathercode: 71,
      visibilityM: 900,
      windKmh: 7.7,
      gustKmh: 33,
      freezingLevelM: null,
      cloudCover: null,
      pressureHpa: null,
    });
    expect(f.days).toEqual([
      { date: '2026-11-20', sunrise: '2026-11-20T07:57', sunset: '2026-11-20T17:34', daylightSeconds: 34603.8, uvMax: 3.45, tempMaxC: -4.3, tempMinC: -8.5 },
    ]);
    expect(f.current).toEqual(expect.objectContaining({ tempC: -6.3, feelsC: -11.1, gustKmh: 54 }));
  });

  it('copes with an empty answer', () => {
    expect(parseMountainForecast({}, 5)).toEqual({ fetchedAt: 5, elevationM: null, utcOffsetSeconds: 0, current: null, days: [], hours: [] });
  });
});

describe('cloud cover and air pressure', () => {
  it('reads them per hour when the forecast has them', () => {
    const f = parseMountainForecast(
      {
        hourly: {
          time: ['2026-11-20T07:00'],
          cloud_cover: [35],
          surface_pressure: [702.4],
        },
      },
      1,
    );
    expect(f.hours[0]).toEqual(expect.objectContaining({ cloudCover: 35, pressureHpa: 702.4 }));
  });
});
