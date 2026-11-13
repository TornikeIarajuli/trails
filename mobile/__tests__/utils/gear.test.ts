import { buildGearPlan, describeForecast, pickForecast, productsForGear, profileRange, GEAR_DISPLAY_ORDER, GearTrail, GearForecast } from '../../utils/gear';
import { GEAR_ITEMS, PRODUCT_GEAR_KEYS, SHOP_CATEGORIES, isGearKey, shopCategoryOf } from '../../utils/gearCatalog';
import { parseDaily } from '../../services/weather';
import { pruneGear, shouldShowPrehikeCheck, useGearStore } from '../../store/gearStore';

const profile = (start: number, top: number): [number, number][] => [
  [0, start],
  [1000, (start + top) / 2],
  [2000, top],
  [3000, start],
];

const easyWalk: GearTrail = {
  distance_km: 3.6,
  elevation_gain_m: 94,
  estimated_hours: 1.5,
  difficulty: 'easy',
  elevation_profile: profile(580, 690),
  review_flags: [],
  terrain: null,
};

const trek: GearTrail = {
  distance_km: 62,
  elevation_gain_m: 3900,
  estimated_hours: 30,
  difficulty: 'hard',
  elevation_profile: profile(1400, 2950),
  review_flags: [],
  terrain: null,
};

const forecast = (over: Partial<GearForecast> = {}): GearForecast => ({
  day: 'today',
  weathercode: 2,
  tempMinC: 12,
  tempMaxC: 22,
  precipProbability: 10,
  snowfallCm: 0,
  elevationM: 600,
  ...over,
});

const keys = (plan: ReturnType<typeof buildGearPlan>) => plan.items.map((i) => i.key);
const item = (plan: ReturnType<typeof buildGearPlan>, key: string) => plan.items.find((i) => i.key === key);

describe('buildGearPlan', () => {
  it('keeps a short summer walk short', () => {
    const plan = buildGearPlan(easyWalk, { month: 7 });
    expect(item(plan, 'water')).toMatchObject({ level: 'essential', note: 'About 1.5 L' });
    expect(item(plan, 'food')?.note).toBe('Snacks');
    expect(item(plan, 'trail_shoes')?.level).toBe('essential');
    for (const k of ['hiking_boots', 'headlamp', 'passport', 'microspikes', 'tent', 'helmet', 'warm_layer']) {
      expect(keys(plan)).not.toContain(k);
    }
    expect(plan.multiDay).toBe(false);
    expect(plan.warnings).toEqual([]);
  });

  it('turns a long route into a multi-day packing list', () => {
    const plan = buildGearPlan(trek, { month: 8 });
    expect(plan.multiDay).toBe(true);
    expect(plan.days).toBe(5);
    expect(item(plan, 'backpack')?.level).toBe('essential');
    expect(item(plan, 'headlamp')?.level).toBe('essential');
    expect(item(plan, 'hiking_boots')?.level).toBe('essential');
    expect(item(plan, 'warm_layer')?.level).toBe('essential');
    expect(keys(plan)).toEqual(expect.arrayContaining(['tent', 'sleeping_bag', 'sleeping_mat', 'cash', 'water_filter', 'trekking_poles']));
    expect(keys(plan)).not.toContain('daypack');
    expect(item(plan, 'food')?.note).toBe('For 5 days, unless you stay in guesthouses');
    expect(plan.warnings[0]).toMatch(/multi-day route: about 5 days/);
  });

  it('asks for a passport near the border and says why', () => {
    const plan = buildGearPlan({ ...easyWalk, review_flags: ['near_border'] }, { month: 7 });
    expect(item(plan, 'passport')?.level).toBe('essential');
    expect(plan.warnings.join(' ')).toMatch(/never cross the line/);
  });

  it('reads terrain: grade, fords, water and huts', () => {
    const plan = buildGearPlan(
      {
        ...trek,
        terrain: {
          source: 'osm',
          fetched_at: '2026-11-14',
          coverage: 0.9,
          max_sac: 'T4',
          sac_km: { T2: 40, T4: 1.2 },
          surfaces_km: { ground: 30 },
          fords: 2,
          water_points: 1,
          shelters: 3,
        },
      },
      { month: 8 },
    );
    expect(item(plan, 'hiking_boots')?.note).toMatch(/Alpine route with scrambling \(SAC T4\)/);
    expect(item(plan, 'helmet')).toMatchObject({ level: 'recommended', note: 'Scrambling and rockfall (SAC T4)' });
    expect(item(plan, 'river_shoes')?.note).toBe('2 river crossings without a bridge');
    expect(item(plan, 'water')?.note).toMatch(/1 water source mapped on the way/);
    expect(item(plan, 'tent')?.note).toMatch(/3 huts mapped on the way/);
  });

  it('uses boots on rocky ground even when the route is otherwise easy', () => {
    const plan = buildGearPlan(
      {
        ...easyWalk,
        terrain: { source: 'osm', fetched_at: '2026-11-14', coverage: 1, max_sac: 'T1', sac_km: {}, surfaces_km: { rock: 1 }, fords: 0, water_points: 0, shelters: 0 },
      },
      { month: 7 },
    );
    expect(item(plan, 'hiking_boots')?.note).toMatch(/^Rocky ground/);
  });

  it('follows the forecast: rain, thunder and snow', () => {
    const rainy = buildGearPlan(easyWalk, { month: 7, forecast: forecast({ precipProbability: 60 }) });
    expect(item(rainy, 'rain_jacket')).toMatchObject({ level: 'essential', note: 'Rain is likely (60%)' });

    const stormy = buildGearPlan(easyWalk, { month: 7, forecast: forecast({ weathercode: 95 }) });
    expect(item(stormy, 'rain_jacket')?.note).toBe('Thunderstorms are forecast');
    expect(stormy.warnings.join(' ')).toMatch(/Thunderstorms are forecast/);

    const snowy = buildGearPlan(easyWalk, { month: 7, forecast: forecast({ snowfallCm: 1 }) });
    expect(item(snowy, 'microspikes')?.level).toBe('essential');

    const dry = buildGearPlan(easyWalk, { month: 7, forecast: forecast() });
    expect(keys(dry)).not.toContain('rain_jacket');
  });

  it('carries the trailhead forecast up to the top', () => {
    const high: GearTrail = { ...easyWalk, estimated_hours: 6, elevation_profile: profile(1700, 3200) };
    const plan = buildGearPlan(high, { month: 7, forecast: forecast({ tempMaxC: 10, tempMinC: 2, elevationM: 1700 }) });
    expect(plan.summitHighC).toBe(0);
    expect(plan.summitLowC).toBe(-8);
    expect(item(plan, 'hat_gloves')).toMatchObject({ level: 'essential', note: 'Below freezing at the top' });
    expect(item(plan, 'warm_layer')).toMatchObject({ level: 'essential', note: 'About 0°C at the top (3,200 m)' });
  });

  it('expects snow up high in winter', () => {
    const plan = buildGearPlan({ ...easyWalk, elevation_profile: profile(1500, 2100) }, { month: 1 });
    expect(item(plan, 'microspikes')?.level).toBe('recommended');
    expect(item(plan, 'warm_layer')?.level).toBe('essential');
    expect(item(plan, 'hiking_boots')?.note).toMatch(/^Snow and mud are likely/);
  });

  it('treats glacier heights as snow all year and suggests a guide above 4,000 m', () => {
    const plan = buildGearPlan({ ...easyWalk, elevation_profile: profile(3600, 4171) }, { month: 7 });
    expect(item(plan, 'microspikes')).toMatchObject({ level: 'recommended', note: 'Snow and ice all year at this height' });
    expect(plan.warnings.join(' ')).toMatch(/reaches 4,171 m.*consider going with a guide/);
  });

  it('falls back to distance and climb when the time is unknown', () => {
    const plan = buildGearPlan({ ...easyWalk, estimated_hours: null, distance_km: 16, elevation_gain_m: 1200 }, { month: 7 });
    expect(plan.hours).toBe(6);
  });

  it('puts essentials first and every item in display order', () => {
    const plan = buildGearPlan(trek, { month: 1, forecast: forecast({ precipProbability: 80 }) });
    const levels = plan.items.map((i) => i.level);
    expect(levels).toEqual([...levels].sort((a, b) => ['essential', 'recommended', 'optional'].indexOf(a) - ['essential', 'recommended', 'optional'].indexOf(b)));
    expect(new Set(keys(plan)).size).toBe(plan.items.length);
  });
});

describe('gear catalog', () => {
  it('orders every item and sells only catalog items', () => {
    expect([...GEAR_DISPLAY_ORDER].sort()).toEqual(Object.keys(GEAR_ITEMS).sort());
    expect(new Set(PRODUCT_GEAR_KEYS).size).toBe(PRODUCT_GEAR_KEYS.length);
    for (const key of PRODUCT_GEAR_KEYS) expect(isGearKey(key)).toBe(true);
    expect(shopCategoryOf('headlamp')).toBe('equipment');
    expect(shopCategoryOf('passport')).toBeNull();
    expect(SHOP_CATEGORIES.map((c) => c.key)).toEqual(['footwear', 'clothing', 'packs', 'camping', 'equipment', 'safety']);
    expect(isGearKey('toString')).toBe(false);
  });

  it('finds the products that cover an item', () => {
    const products = [
      { id: 'a', gear_tags: ['hiking_boots'] },
      { id: 'b', gear_tags: ['tent'] },
      { id: 'c' },
    ];
    expect(productsForGear(products, 'hiking_boots').map((p) => p.id)).toEqual(['a']);
    expect(productsForGear(undefined, 'tent')).toEqual([]);
  });
});

describe('forecast helpers', () => {
  const weather = {
    temperature: 6,
    windspeed: 9,
    weathercode: 3,
    is_day: true,
    elevation: 1759,
    localHour: 9,
    daily: parseDaily({
      time: ['2026-11-14', '2026-11-15'],
      weather_code: [61, 71],
      temperature_2m_max: [12.6, 6.4],
      temperature_2m_min: [5.4, -0.9],
      precipitation_probability_max: [23, 86],
      snowfall_sum: [0, 0.07],
    }),
  };

  it('picks today in the morning and tomorrow from 2 pm', () => {
    expect(pickForecast(weather)).toMatchObject({ day: 'today', tempMaxC: 12.6, elevationM: 1759 });
    expect(pickForecast({ ...weather, localHour: 15 })).toMatchObject({ day: 'tomorrow', precipProbability: 86, snowfallCm: 0.07 });
    expect(pickForecast({ ...weather, daily: [] })).toBeNull();
    expect(pickForecast(undefined)).toBeNull();
  });

  it('describes the forecast in one line', () => {
    expect(describeForecast(pickForecast(weather)!)).toBe('Today at the trailhead: 5–13°C, 23% chance of rain');
  });

  it('tolerates missing forecast columns', () => {
    expect(parseDaily({ time: ['2026-11-14'] })).toEqual([
      { date: '2026-11-14', weathercode: null, tempMaxC: null, tempMinC: null, precipProbability: null, snowfallCm: null },
    ]);
    expect(parseDaily(undefined)).toEqual([]);
  });

  it('reads the height range of a profile', () => {
    expect(profileRange(profile(580, 690))).toEqual({ min: 580, max: 690, start: 580 });
    expect(profileRange(null)).toBeNull();
  });
});

describe('gear store', () => {
  beforeEach(() => useGearStore.setState({ ticks: {}, prehikeShownOn: {} }));

  it('ticks, unticks and clears per trail', () => {
    const { toggle, setChecked, clear } = useGearStore.getState();
    toggle('t1', 'water');
    toggle('t1', 'food');
    toggle('t1', 'water');
    setChecked('t1', 'offline_map', true);
    setChecked('t1', 'offline_map', true);
    expect(useGearStore.getState().ticks.t1.checked).toEqual(['food', 'offline_map']);
    clear('t1');
    expect(useGearStore.getState().ticks.t1).toBeUndefined();
  });

  it('forgets stale lists and other days’ pre-hike marks', () => {
    const now = Date.UTC(2026, 10, 14);
    const pruned = pruneGear(
      {
        ticks: {
          fresh: { checked: ['water'], updatedAt: now - 2 * 24 * 3600 * 1000 },
          stale: { checked: ['water'], updatedAt: now - 20 * 24 * 3600 * 1000 },
        },
        prehikeShownOn: { a: '2026-11-14', b: '2026-11-13' },
      },
      now,
      '2026-11-14',
    );
    expect(Object.keys(pruned.ticks)).toEqual(['fresh']);
    expect(pruned.prehikeShownOn).toEqual({ a: '2026-11-14' });
  });

  it('shows the pre-hike check once a day while essentials are missing', () => {
    const base = { essentials: ['water', 'food'], today: '2026-11-14' };
    expect(shouldShowPrehikeCheck({ ...base, checked: ['water'], shownOn: undefined })).toBe(true);
    expect(shouldShowPrehikeCheck({ ...base, checked: ['water', 'food'], shownOn: undefined })).toBe(false);
    expect(shouldShowPrehikeCheck({ ...base, checked: [], shownOn: '2026-11-14' })).toBe(false);
    expect(shouldShowPrehikeCheck({ ...base, checked: [], shownOn: '2026-11-13' })).toBe(true);
  });
});
