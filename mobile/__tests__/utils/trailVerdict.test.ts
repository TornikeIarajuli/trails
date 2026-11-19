import {
  dayName,
  defaultDayIndex,
  finishAfterDark,
  forecastPoint,
  formatDaylight,
  judgeDay,
  judgeForecast,
  neededHours,
  verdictForToday,
} from '../../utils/trailVerdict';
import type { DayForecast, HourForecast, MountainForecast } from '../../services/forecast';

const DATE = '2026-11-21';

/** A calm, clear, mild hour; tests change what they need. */
function hour(h: number, extra: Partial<HourForecast> = {}, date = DATE): HourForecast {
  return {
    time: `${date}T${String(h).padStart(2, '0')}:00`,
    tempC: 8,
    feelsC: 6,
    precipMm: 0,
    precipProbability: 5,
    snowCm: 0,
    weathercode: 1,
    visibilityM: 30000,
    windKmh: 10,
    gustKmh: 20,
    freezingLevelM: 3600,
    ...extra,
  };
}

/** 24 hours, with `change` applied to the hours it returns something for. */
function dayHours(change: (h: number) => Partial<HourForecast> | undefined = () => undefined, date = DATE) {
  return Array.from({ length: 24 }, (_, h) => hour(h, change(h) ?? {}, date));
}

const day = (extra: Partial<DayForecast> = {}, date = DATE): DayForecast => ({
  date,
  sunrise: `${date}T07:00`,
  sunset: `${date}T18:00`,
  daylightSeconds: 11 * 3600,
  uvMax: 3,
  tempMaxC: 10,
  tempMinC: 2,
  ...extra,
});

const trail = { neededHours: 5, topM: 2400 };

describe('judgeDay', () => {
  it('says go on a dry, calm day', () => {
    const v = judgeDay(day(), dayHours(), trail)!;
    expect(v).toEqual(expect.objectContaining({ verdict: 'go', label: 'Go', headline: 'Dry and calm', window: null, notes: [] }));
    expect(v.sunrise).toBe('07:00');
    expect(v.sunset).toBe('18:00');
  });

  it('says go early when storms come after lunch and the morning is long enough', () => {
    const v = judgeDay(day(), dayHours((h) => (h >= 14 ? { weathercode: 95 } : undefined)), trail)!;
    expect(v.verdict).toBe('go');
    expect(v.label).toBe('Go early');
    expect(v.headline).toBe('Thunderstorms likely from 14:00');
    expect(v.window).toEqual({ start: '07:00', end: '14:00' });
  });

  it('says wait when the good hours are too short for the hike', () => {
    const long = { neededHours: 8, topM: 2400 };
    const v = judgeDay(day(), dayHours((h) => (h >= 14 ? { weathercode: 95 } : undefined)), long)!;
    expect(v.verdict).toBe('wait');
    expect(v.label).toBe('Wait');
    expect(v.window).toEqual({ start: '07:00', end: '14:00' });
  });

  it('says go after the morning fog lifts', () => {
    const v = judgeDay(day(), dayHours((h) => (h < 10 ? { visibilityM: 150 } : undefined)), trail)!;
    expect(v.label).toBe('Go after 10:00');
    expect(v.headline).toBe('Thick cloud on the tops until 10:00');
  });

  it('skips a day with gale-force gusts, however short the windy spell', () => {
    const v = judgeDay(day(), dayHours((h) => (h === 12 ? { gustKmh: 92 } : undefined)), trail)!;
    expect(v.verdict).toBe('skip');
    expect(v.headline).toBe('Gusts up to 92 km/h at the top 12:00–13:00');
  });

  it('skips a day of heavy snow, with the amount', () => {
    const v = judgeDay(day(), dayHours((h) => (h >= 9 && h < 15 ? { snowCm: 2.5, weathercode: 75 } : undefined)), trail)!;
    expect(v.verdict).toBe('skip');
    expect(v.headline).toBe('Snow 09:00–15:00, about 15 cm');
    expect(v.weathercode).toBe(75);
  });

  it('skips a day that is mostly spoiled', () => {
    const v = judgeDay(day(), dayHours((h) => (h % 3 !== 0 ? { precipMm: 3 } : undefined)), trail)!;
    expect(v.verdict).toBe('skip');
    expect(v.headline).toMatch(/^Rain on and off all day, about \d+ mm$/);
  });

  it('lists what is worth knowing on a good day', () => {
    const v = judgeDay(
      day({ uvMax: 8.6 }),
      dayHours((h) =>
        h === 15 ? { precipProbability: 70, precipMm: 0.6, gustKmh: 48, visibilityM: 1200, feelsC: -11, freezingLevelM: 2150 } : undefined,
      ),
      trail,
    )!;
    expect(v.verdict).toBe('go');
    expect(v.headline).toBe('Fine overall');
    expect(v.notes).toEqual([
      'Showers possible',
      'Windy at the top, gusts to 48 km/h',
      'Cloud may hide the views',
      'Bitter cold at the top: feels like -11°',
      'Freezing above 2,200 m: ice or snow likely up high',
      'Very strong sun (UV 9)',
    ]);
  });

  it('only looks at daylight: a storm at night does not spoil the day', () => {
    const v = judgeDay(day(), dayHours((h) => (h < 5 || h > 20 ? { weathercode: 95, gustKmh: 90 } : undefined)), trail)!;
    expect(v.verdict).toBe('go');
    expect(v.gustMaxKmh).toBe(20);
  });

  it('has no verdict for a day without hourly data', () => {
    expect(judgeDay(day({}, '2026-11-30'), dayHours(), trail)).toBeNull();
  });
});

describe('neededHours', () => {
  it("uses the trail's estimate, rounded up, at least 2 and at most 9 hours", () => {
    expect(neededHours({ estimated_hours: 4.5 })).toBe(5);
    expect(neededHours({ estimated_hours: 1 })).toBe(2);
    expect(neededHours({ distance_km: 12, elevation_gain_m: 900 })).toBe(5);
  });

  it('counts one day of walking on a multi-day trek', () => {
    expect(neededHours({ estimated_hours: 30 })).toBe(8);
  });
});

describe('forecastPoint', () => {
  const route = [
    { latitude: 42.0, longitude: 44.0 },
    { latitude: 42.01, longitude: 44.0 },
    { latitude: 42.02, longitude: 44.0 },
  ];

  it('asks at the highest point of the profile, placed along the route, with its height', () => {
    const p = forecastPoint(route, [[0, 1500], [1112, 2100], [2224, 1800]], route[0])!;
    expect(p.elevationM).toBe(2100);
    expect(p.atTop).toBe(true);
    expect(p.latitude).toBeCloseTo(42.01, 3);
  });

  it('falls back to the start, with the top height when there is no route, and none without a profile', () => {
    expect(forecastPoint([], [[0, 1500], [800, 2350]], route[0])).toEqual({ ...route[0], elevationM: 2350, atTop: true });
    expect(forecastPoint(route, null, route[0])).toEqual({ ...route[0], elevationM: null, atTop: false });
    expect(forecastPoint([], [], null)).toBeNull();
  });
});

describe('days', () => {
  // 2026-11-21 10:00 in Tbilisi (UTC+4) is 06:00 UTC
  const offset = 4 * 3600;
  const at = (utc: string) => Date.parse(utc);
  const forecast: MountainForecast = {
    fetchedAt: 0,
    elevationM: 2400,
    utcOffsetSeconds: offset,
    current: null,
    days: [day({}, '2026-11-20'), day({}, '2026-11-21'), day({}, '2026-11-22')],
    hours: [...dayHours(undefined, '2026-11-20'), ...dayHours(undefined, '2026-11-21'), ...dayHours(undefined, '2026-11-22')],
  };

  it('starts from today at the trail, even for a forecast saved yesterday', () => {
    const verdicts = judgeForecast(forecast, trail, at('2026-11-21T06:00:00Z'));
    expect(verdicts.map((v) => v.date)).toEqual(['2026-11-21', '2026-11-22']);
  });

  it('opens on today until 2 pm, then on tomorrow', () => {
    const verdicts = judgeForecast(forecast, trail, at('2026-11-21T06:00:00Z'));
    expect(defaultDayIndex(verdicts, offset, at('2026-11-21T06:00:00Z'))).toBe(0);
    expect(defaultDayIndex(verdicts, offset, at('2026-11-21T10:30:00Z'))).toBe(1);
  });

  it('warns when a hike started now would end after sunset', () => {
    const today = judgeForecast(forecast, trail, at('2026-11-21T06:00:00Z'))[0];
    expect(finishAfterDark(today, 5, offset, at('2026-11-21T06:00:00Z'))).toBeNull(); // 10:00 + 5 h
    expect(finishAfterDark(today, 5, offset, at('2026-11-21T10:00:00Z'))).toBe('18:00'); // 14:00 + 5 h
    expect(finishAfterDark(today, 4, offset, at('2026-11-21T10:30:00Z'))).toBe('18:00'); // 14:30 + 4 h
    expect(finishAfterDark(today, 4, offset, at('2026-11-21T10:00:00Z'))).toBeNull(); // 14:00 + 4 h, just in time
    expect(finishAfterDark(today, 5, offset, at('2026-11-21T15:00:00Z'))).toBeNull(); // after dark already
  });

  it('names the days and the daylight', () => {
    expect(['2026-11-21', '2026-11-22', '2026-11-23', '2026-11-28'].map(dayName)).toEqual(['Today', 'Tomorrow', 'Mon', 'Sat']);
    expect(formatDaylight(34720)).toBe('9 h 39 min');
  });
});

describe('short spells and several spoilers', () => {
  it('counts an hour of cloud or a single shower as a note, not a spoiler', () => {
    const v = judgeDay(day(), dayHours((h) => (h === 10 ? { visibilityM: 150 } : h === 15 ? { precipMm: 3, precipProbability: 80 } : undefined)), trail)!;
    expect(v).toEqual(expect.objectContaining({ verdict: 'go', label: 'Go', headline: 'Fine overall' }));
    expect(v.notes).toEqual(['Showers possible', 'Cloud may hide the views']);
  });

  it('names the worst spoiler and lists the others first among the notes', () => {
    const v = judgeDay(
      day(),
      dayHours((h) => (h >= 8 && h < 13 ? { visibilityM: 100 } : h >= 15 ? { weathercode: 95 } : undefined)),
      trail,
    )!;
    expect(v.verdict).toBe('skip');
    expect(v.headline).toBe('Thunderstorms likely from 15:00');
    expect(v.notes[0]).toBe('Thick cloud on the tops 08:00–13:00');
  });

  it('times a day of steady light snow that adds up to a lot', () => {
    const v = judgeDay(day(), dayHours((h) => (h >= 7 && h < 18 ? { snowCm: 0.95 } : undefined)), trail)!;
    expect(v.verdict).toBe('skip');
    expect(v.headline).toBe('Snow all day, about 10 cm');
  });
});

describe('verdictForToday', () => {
  const offset = 4 * 3600;
  const f: MountainForecast = {
    fetchedAt: 0,
    elevationM: 2400,
    utcOffsetSeconds: offset,
    current: null,
    days: [day({}, '2026-11-21')],
    hours: dayHours((h) => (h === 12 ? { gustKmh: 95 } : undefined), '2026-11-21'),
  };

  it("gives today's verdict for the warning before a hike", () => {
    expect(verdictForToday(f, trail, Date.parse('2026-11-21T06:00:00Z'))).toEqual(expect.objectContaining({ verdict: 'skip' }));
  });

  it('has none once the forecast no longer covers today', () => {
    expect(verdictForToday(f, trail, Date.parse('2026-11-22T06:00:00Z'))).toBeNull();
  });
});
