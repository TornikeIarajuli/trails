/** Go, wait or skip per activity: each reads the forecast for what matters to it. */
import { ACTIVITIES, Activity, ActivityContext, judgeActivity } from '../../utils/activities';
import { judgeForecast } from '../../utils/trailVerdict';
import type { HourForecast, MountainForecast } from '../../services/forecast';

const GEORGIA = 4 * 3600;
// Two past days (the forecast asks for them: rain that fell still counts), today, three ahead
const DATES = ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'];
const NOW = Date.parse('2026-11-20T02:00:00Z'); // 06:00 at the place
const CTX: ActivityContext = { neededHours: 5, topM: 2400, latitude: 42.5, longitude: 44.7 };

function build(tweak: (date: string, hour: number) => Partial<HourForecast> = () => ({})): MountainForecast {
  return {
    fetchedAt: NOW,
    elevationM: 2400,
    utcOffsetSeconds: GEORGIA,
    current: null,
    days: DATES.map((date) => ({
      date,
      sunrise: `${date}T07:55`,
      sunset: `${date}T17:35`,
      daylightSeconds: 34800,
      uvMax: 2,
      tempMaxC: 8,
      tempMinC: -2,
    })),
    hours: DATES.flatMap((date) =>
      Array.from({ length: 24 }, (_, h) => ({
        time: `${date}T${String(h).padStart(2, '0')}:00`,
        tempC: 6,
        feelsC: 4,
        precipMm: 0,
        precipProbability: 0,
        snowCm: 0,
        weathercode: 1,
        visibilityM: 30000,
        windKmh: 8,
        gustKmh: 15,
        freezingLevelM: 3200,
        cloudCover: 40,
        pressureHpa: 800,
        ...tweak(date, h),
      })),
    ),
  };
}

const judge = (activity: Activity, f: MountainForecast, ctx: ActivityContext = CTX, now = NOW) => judgeActivity(activity, f, ctx, now);
const labels = (v: { highlights?: { label: string }[] }) => (v.highlights ?? []).map((h) => h.label);

it('offers eight activities, each once', () => {
  expect(ACTIVITIES.map((a) => a.key)).toEqual(['hiking', 'camping', 'fishing', 'photography', 'stargazing', 'offroad', 'running', 'alpinism']);
});

it('starts from today, not the past days the forecast carries', () => {
  for (const a of ACTIVITIES) {
    expect(judge(a.key, build())[0].date).toBe('2026-11-20');
  }
});

it('is the trail verdict for hiking', () => {
  const f = build();
  expect(judge('hiking', f)).toEqual(judgeForecast(f, { neededHours: 5, topM: 2400 }, NOW));
});

describe('camping', () => {
  it('goes on a calm, dry night, with the night low and the sunset', () => {
    const [today] = judge('camping', build());
    expect(today.verdict).toBe('go');
    expect(today.headline).toBe('Calm, dry night, low 6°');
    expect(labels(today)).toEqual(['Night low', 'Sunset', 'Wind tonight']);
  });

  it('skips a night with thunderstorms', () => {
    const verdicts = judge('camping', build((d, h) => (d === '2026-11-21' && h === 23 ? { weathercode: 95 } : {})));
    expect(verdicts[0].verdict).toBe('go');
    expect(verdicts[1]).toEqual(expect.objectContaining({ verdict: 'skip', headline: 'Thunderstorms in the night' }));
  });

  it('waits on a windy night', () => {
    const [today] = judge('camping', build((d, h) => (d === '2026-11-21' && h === 2 ? { gustKmh: 45 } : {})));
    expect(today).toEqual(expect.objectContaining({ verdict: 'wait', headline: 'Windy night: gusts to 45 km/h' }));
  });

  it('warns of fire risk on a hot, dry, windy day', () => {
    const [today] = judge(
      'camping',
      build((d, h) => (d === '2026-11-20' && h >= 8 && h <= 17 ? { tempC: 30, feelsC: 30, gustKmh: 30 } : {})),
    );
    expect(today.notes).toContain('High fire risk: hot, dry and windy. No open fires.');
  });
});

describe('fishing', () => {
  it('gives the bite windows around dawn, dusk and the moon', () => {
    const [today] = judge('fishing', build());
    expect(today.verdict).toBe('go');
    expect(today.headline).toMatch(/^Best bite \d{2}:\d{2}–\d{2}:\d{2}/);
    expect(today.highlights![0].label).toBe('Bite windows');
    expect(today.highlights![0].value).toMatch(/^\d{2}:\d{2}–\d{2}:\d{2}(, \d{2}:\d{2}–\d{2}:\d{2}){0,2}$/);
  });

  it('skips a gale on the water', () => {
    const [today] = judge('fishing', build((d, h) => (d === '2026-11-20' && h >= 10 && h <= 12 ? { gustKmh: 55 } : {})));
    expect(today).toEqual(expect.objectContaining({ verdict: 'skip', headline: 'Gusts up to 55 km/h on the water' }));
  });

  it('notes a falling barometer', () => {
    const [today] = judge(
      'fishing',
      build((d, h) => (d === '2026-11-20' ? { pressureHpa: h === 6 ? 806 : h === 18 ? 800 : 803 } : {})),
    );
    expect(today.notes).toContain('Falling pressure: fish often feed before a change in the weather');
  });
});

describe('photography', () => {
  it('goes for broken cloud at golden hour', () => {
    const [today] = judge('photography', build());
    expect(today.verdict).toBe('go');
    expect(today.headline).toMatch(/^Golden hour \d{2}:\d{2}–\d{2}:\d{2}: good chance of colour in the clouds$/);
    expect(labels(today)).toEqual(['Golden morning', 'Golden evening', 'Blue hour']);
  });

  it('waits when it rains at golden hour', () => {
    const [today] = judge('photography', build(() => ({ cloudCover: 100, precipMm: 1 })));
    expect(today).toEqual(expect.objectContaining({ verdict: 'wait', headline: 'Rain at golden hour' }));
  });

  it('says nothing about colour when the forecast has no cloud cover', () => {
    const [today] = judge('photography', build(() => ({ cloudCover: undefined })));
    expect(today.verdict).toBe('wait');
    expect(today.headline).toMatch(/^Golden hour \d{2}:\d{2}–\d{2}:\d{2}$/);
  });
});

describe('stargazing', () => {
  it('skips an overcast night and says why', () => {
    const [today] = judge('stargazing', build(() => ({ cloudCover: 100 })));
    expect(today.verdict).toBe('skip');
    expect(today.headline).toMatch(/^Poor night for stars: overcast/);
    expect(labels(today)).toEqual(['Dark', 'Moon', 'Cloud']);
  });

  it('notes a cold night', () => {
    const [today] = judge('stargazing', build(() => ({ feelsC: -3 })));
    expect(today.notes).toContain('Cold night: feels like -3°');
  });
});

describe('4×4', () => {
  it('goes on dry tracks', () => {
    const [today] = judge('offroad', build());
    expect(today).toEqual(expect.objectContaining({ verdict: 'go', headline: 'Dry tracks: no rain in the last two days' }));
  });

  it('skips deep mud after heavy rain yesterday, and warns about the fords', () => {
    const f = build((d, h) => (d === '2026-11-19' && h >= 10 && h <= 14 ? { precipMm: 5 } : {}));
    const [today] = judge('offroad', f, { ...CTX, fords: 2 });
    expect(today.verdict).toBe('skip');
    expect(today.headline).toBe('Deep mud likely: 25 mm of rain in two days');
    expect(today.notes).toEqual(['2 river crossings: high after the rain']);
    expect(today.highlights).toEqual([
      { label: 'Rain, last 48 h', value: '25 mm' },
      { label: 'Rain today', value: '0 mm' },
    ]);
  });

  it('waits for ice on wet, freezing tracks', () => {
    const f = build((d, h) =>
      d === '2026-11-19' && h === 12 ? { precipMm: 3 } : d === '2026-11-20' && h >= 6 && h <= 19 ? { tempC: -2 } : {},
    );
    const [today] = judge('offroad', f);
    expect(today).toEqual(expect.objectContaining({ verdict: 'wait', headline: 'Ice likely on wet tracks' }));
  });
});

describe('running', () => {
  it('finds the best two hours, before the heat', () => {
    const f = build((d, h) =>
      d !== '2026-11-20' ? {} : h >= 6 && h <= 10 ? { tempC: 15, feelsC: 15 } : h >= 11 && h <= 21 ? { tempC: 30, feelsC: 30 } : {},
    );
    const [today] = judge('running', f);
    expect(today.verdict).toBe('go');
    expect(today.headline).toBe('Best time 06:00–08:00, before the heat');
    expect(today.window).toEqual({ start: '06:00', end: '08:00' });
    expect(today.notes).toContain('Hot later: feels like 30°');
  });

  it('does not suggest a time that has passed', () => {
    const late = Date.parse('2026-11-20T18:30:00Z'); // 22:30 at the place
    const [today] = judge('running', build(), CTX, late);
    expect(today.date).toBe('2026-11-20');
    expect(today.headline).toBe('Too late for a run today');
  });
});

describe('climbing', () => {
  const alpine: ActivityContext = { ...CTX, topM: 3500 };

  it('goes when it is settled until 14:00, with an alpine start and the freezing level', () => {
    const [today] = judge('alpinism', build(), alpine);
    expect(today.verdict).toBe('go');
    expect(today.headline).toMatch(/^Settled until 14:00: start by 0[56]:\d{2}$/);
    expect(today.notes).toEqual(['Freezing above 3200 m: hard snow and ice, crampons and axe']);
    expect(today.highlights![0]).toEqual({ label: 'Freezing level', value: '3,200 m' });
  });

  it('skips gales before 14:00', () => {
    const [today] = judge('alpinism', build((d, h) => (d === '2026-11-20' && h === 10 ? { gustKmh: 75 } : {})), alpine);
    expect(today).toEqual(expect.objectContaining({ verdict: 'skip', headline: 'Gusts up to 75 km/h at the top' }));
  });

  it('waits after fresh snow', () => {
    const [today] = judge('alpinism', build((d, h) => (d === '2026-11-19' && h >= 8 && h <= 13 ? { snowCm: 2 } : {})), alpine);
    expect(today).toEqual(expect.objectContaining({ verdict: 'wait', headline: 'Fresh snow: 12 cm in two days' }));
  });
});
