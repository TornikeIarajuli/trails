import type { SacGrade, TrailDifficulty, TrailTerrain } from '../types/trail';
import type { WeatherData } from '../services/weather';
import { GEAR_ITEMS, GearKey } from './gearCatalog';

/**
 * Builds the "What to bring" list for one trail from what the app already knows about it:
 * length and time, climb, altitude, the month, the trailhead forecast, terrain from
 * OpenStreetMap and the content flags. Pure, so the rules can be tested.
 */

export type GearLevel = 'essential' | 'recommended' | 'optional';

export interface GearItem {
  key: GearKey;
  label: string;
  icon: string;
  level: GearLevel;
  /** Why it is on the list, or how much to take. */
  note: string | null;
}

export interface GearForecast {
  day: 'today' | 'tomorrow';
  weathercode: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  precipProbability: number | null;
  snowfallCm: number | null;
  /** Height of the forecast point in metres. */
  elevationM: number | null;
}

export interface GearTrail {
  distance_km: number | null;
  elevation_gain_m: number | null;
  estimated_hours: number | null;
  difficulty: TrailDifficulty;
  elevation_profile?: [number, number][] | null;
  review_flags?: string[];
  terrain?: TrailTerrain | null;
}

export interface GearPlan {
  items: GearItem[];
  hours: number;
  multiDay: boolean;
  days: number;
  maxElevationM: number | null;
  /** Estimated daytime high / morning low at the highest point, from the trailhead forecast. */
  summitHighC: number | null;
  summitLowC: number | null;
  warnings: string[];
}

/** Order on screen inside each level: what people forget most first. */
const DISPLAY_ORDER: GearKey[] = [
  'water', 'food', 'hiking_boots', 'trail_shoes', 'rain_jacket', 'warm_layer', 'hat_gloves',
  'microspikes', 'helmet', 'first_aid', 'offline_map', 'passport', 'headlamp', 'power_bank',
  'sun_protection', 'daypack', 'backpack', 'trekking_poles', 'hiking_socks', 'quick_dry_clothes',
  'river_shoes', 'water_filter', 'tent', 'sleeping_bag', 'sleeping_mat', 'stove', 'cash', 'knife',
  'insect_repellent', 'rubbish_bag',
];
export const GEAR_DISPLAY_ORDER: readonly GearKey[] = DISPLAY_ORDER;

const LEVEL_ORDER: Record<GearLevel, number> = { essential: 0, recommended: 1, optional: 2 };

const SAC_DESCRIPTION: Record<SacGrade, string> = {
  T1: 'Easy path',
  T2: 'Mountain path',
  T3: 'Demanding mountain path',
  T4: 'Alpine route with scrambling',
  T5: 'Demanding alpine route',
  T6: 'Difficult alpine route',
};

/** Temperature drop per metre of height (standard atmosphere). */
const LAPSE_RATE = 0.0065;

/** Walking a long day is about this many hours; more than MULTI_DAY_HOURS means camping or guesthouses. */
const HOURS_PER_DAY = 7;
const MULTI_DAY_HOURS = 10;

function sacNumber(grade: SacGrade | null | undefined): number {
  return grade ? Number(grade.slice(1)) : 0;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function formatElevation(m: number): string {
  return `${Math.round(m).toLocaleString('en-US')} m`;
}

function formatLitres(l: number): string {
  return Number.isInteger(l) ? `${l}` : l.toFixed(1);
}

/** Lowest, highest and first height of an elevation profile (`[distance_m, elevation_m]` pairs). */
export function profileRange(
  profile: [number, number][] | null | undefined,
): { min: number; max: number; start: number } | null {
  const heights = (profile ?? []).map((p) => p?.[1]).filter((e): e is number => typeof e === 'number' && Number.isFinite(e));
  if (heights.length === 0) return null;
  return { min: Math.min(...heights), max: Math.max(...heights), start: heights[0] };
}

/** Today's forecast until 2 pm at the trail; after that people are planning for tomorrow. */
export function pickForecast(weather: WeatherData | null | undefined): GearForecast | null {
  const days = weather?.daily ?? [];
  if (days.length === 0) return null;
  const tomorrow = (weather?.localHour ?? 0) >= 14 && days.length > 1;
  const d = days[tomorrow ? 1 : 0];
  return {
    day: tomorrow ? 'tomorrow' : 'today',
    weathercode: d.weathercode,
    tempMinC: d.tempMinC,
    tempMaxC: d.tempMaxC,
    precipProbability: d.precipProbability,
    snowfallCm: d.snowfallCm,
    elevationM: weather?.elevation ?? null,
  };
}

/** "Today at the trailhead: 5–13°C, 23% chance of rain" */
export function describeForecast(f: GearForecast): string | null {
  const parts: string[] = [];
  if (f.tempMinC != null && f.tempMaxC != null) {
    parts.push(`${Math.round(f.tempMinC)}–${Math.round(f.tempMaxC)}°C`);
  }
  if (f.precipProbability != null) parts.push(`${Math.round(f.precipProbability)}% chance of rain`);
  if (parts.length === 0) return null;
  return `${f.day === 'today' ? 'Today' : 'Tomorrow'} at the trailhead: ${parts.join(', ')}`;
}

export function buildGearPlan(
  trail: GearTrail,
  options: { month: number; forecast?: GearForecast | null },
): GearPlan {
  const { month } = options;
  const f = options.forecast ?? null;
  const items = new Map<GearKey, GearItem>();
  const add = (key: GearKey, level: GearLevel, note: string | null = null) => {
    items.set(key, { key, label: GEAR_ITEMS[key].label, icon: GEAR_ITEMS[key].icon, level, note });
  };

  const estimated =
    trail.distance_km != null ? trail.distance_km / 4 + (trail.elevation_gain_m ?? 0) / 600 : null;
  const hours = trail.estimated_hours ?? estimated ?? 3;
  const multiDay = hours > MULTI_DAY_HOURS;
  const days = multiDay ? Math.ceil(hours / HOURS_PER_DAY) : 1;
  const gain = trail.elevation_gain_m ?? 0;
  const range = profileRange(trail.elevation_profile);
  const maxElev = range?.max ?? null;
  const high = maxElev ?? 0;
  const hard = trail.difficulty === 'hard' || trail.difficulty === 'ultra';
  const nearBorder = (trail.review_flags ?? []).includes('near_border');

  const terrain = trail.terrain ?? null;
  const sac = sacNumber(terrain?.max_sac);
  const rockKm = terrain?.surfaces_km?.rock ?? 0;
  const rockShare = trail.distance_km ? rockKm / trail.distance_km : 0;
  const fords = terrain?.fords ?? 0;
  const waterPoints = terrain?.water_points ?? 0;
  const shelters = terrain?.shelters ?? 0;

  const winter = [12, 1, 2].includes(month);
  const coldSeason = [11, 12, 1, 2, 3].includes(month);
  const coolSeason = [10, 11, 12, 1, 2, 3, 4].includes(month);
  const snowSeason = [11, 12, 1, 2, 3, 4].includes(month);
  const summer = [6, 7, 8].includes(month);
  const sunSeason = month >= 4 && month <= 9;

  // Forecast at the trailhead, carried up to the highest point
  const base = f?.elevationM ?? range?.start ?? null;
  const lapse = maxElev != null && base != null ? Math.max(0, maxElev - base) * LAPSE_RATE : 0;
  const summitHighC = f?.tempMaxC != null ? Math.round(f.tempMaxC - lapse) : null;
  const summitLowC = f?.tempMinC != null ? Math.round(f.tempMinC - lapse) : null;
  const rainChance = f?.precipProbability ?? null;
  const thunder = f?.weathercode != null && f.weathercode >= 95;
  const snowfall = f?.snowfallCm ?? 0;
  const hot = f?.tempMaxC != null ? f.tempMaxC >= 27 : summer && high < 1500;

  // ── Water and food ──
  const litres = Math.max(0.5, Math.ceil(hours * (hot ? 0.75 : 0.5) * 2) / 2);
  let waterNote = multiDay
    ? 'At least 2 L at a time, refilling on the way'
    : litres > 3
      ? `About ${formatLitres(litres)} L, or less where you can refill`
      : `About ${formatLitres(litres)} L`;
  if (waterPoints > 0) waterNote += ` · ${plural(waterPoints, 'water source')} mapped on the way`;
  add('water', 'essential', waterNote);
  add('food', 'essential', hours <= 3 ? 'Snacks' : multiDay ? `For ${days} days, unless you stay in guesthouses` : 'Lunch and snacks');

  // ── Footwear ──
  const bootReason =
    sac >= 3 && terrain?.max_sac
      ? `${SAC_DESCRIPTION[terrain.max_sac]} (SAC ${terrain.max_sac})`
      : snowfall > 0 || (snowSeason && high >= 1500)
        ? 'Snow and mud are likely'
        : rockShare >= 0.15
          ? 'Rocky ground'
          : hard
            ? 'A demanding route'
            : gain >= 800
              ? `A long climb (${formatElevation(gain)})`
              : high >= 2500
                ? 'High mountain terrain'
                : multiDay
                  ? 'Several days with a heavy pack'
                  : null;
  if (bootReason) add('hiking_boots', 'essential', `${bootReason}: you want ankle support and grip`);
  else add('trail_shoes', 'essential', 'Trail shoes or sturdy sneakers are fine here');
  if (hours >= 4) add('hiking_socks', 'recommended', 'Wool or synthetic, to avoid blisters');

  // ── Clothing ──
  if (hours >= 3 || hot) add('quick_dry_clothes', 'recommended', 'Avoid cotton: it stays wet and cold');

  if (thunder) add('rain_jacket', 'essential', 'Thunderstorms are forecast');
  else if (rainChance != null && rainChance >= 40) add('rain_jacket', 'essential', `Rain is likely (${Math.round(rainChance)}%)`);
  else if (high >= 1500 || hours >= 5 || multiDay) add('rain_jacket', 'recommended', 'Mountain weather changes fast');
  else if (rainChance != null && rainChance >= 20) add('rain_jacket', 'optional', `${Math.round(rainChance)}% chance of rain`);

  const summitNote =
    summitHighC != null && maxElev != null && maxElev - (base ?? maxElev) >= 300
      ? `About ${summitHighC}°C at the top (${formatElevation(maxElev)})`
      : null;
  if ((summitLowC != null && summitLowC <= 3) || high >= 2500 || coldSeason) {
    add('warm_layer', 'essential', summitNote ?? (high >= 2500 ? `Cold at ${formatElevation(high)}, even in summer` : 'Cold season in the mountains'));
  } else if (high >= 1800 || coolSeason || (summitHighC != null && summitHighC < 15) || multiDay) {
    add('warm_layer', 'recommended', summitNote ?? (high >= 1800 ? 'It gets cool higher up' : 'Cool mornings and evenings'));
  }

  if (summitHighC != null && summitHighC <= 0) {
    add('hat_gloves', 'essential', 'Below freezing at the top');
  } else if ((summitHighC != null && summitHighC <= 5) || high >= 3000 || (coldSeason && high >= 1200)) {
    add('hat_gloves', 'recommended', high >= 3000 ? `Wind chill above ${formatElevation(3000)}` : 'Close to freezing up high');
  }

  if (sunSeason || high >= 2000 || (snowSeason && high >= 1800)) {
    add(
      'sun_protection',
      'recommended',
      snowSeason && high >= 1800 ? 'Glare from snow: sunglasses matter' : high >= 2000 ? 'UV is strong at altitude' : 'Sunglasses, hat and sunscreen',
    );
  }

  // ── Packs ──
  if (multiDay) add('backpack', 'essential', '40–60 L, for sleeping gear and food');
  else add('daypack', 'recommended', '15–30 L');

  // ── Safety and navigation ──
  add('first_aid', trail.difficulty !== 'easy' || hours >= 4 || multiDay ? 'essential' : 'recommended', 'Plasters, blister pads, painkillers and a whistle');
  add(
    'offline_map',
    hours >= 3 || high >= 1500 || multiDay ? 'essential' : 'recommended',
    'Save this trail offline: mountain signal is patchy',
  );
  if (nearBorder) add('passport', 'essential', 'The route comes within 3 km of a border or the occupation line');

  if (multiDay || hours >= 8) add('headlamp', 'essential', 'In case you finish after dark');
  else if (hours >= 5 || (winter && hours >= 3)) add('headlamp', 'recommended', winter ? 'Winter days are short' : 'In case you finish after dark');
  if (hours >= 4 || multiDay) add('power_bank', 'recommended', 'GPS tracking uses battery');

  if (snowfall >= 0.5) add('microspikes', 'essential', 'Snow is forecast');
  else if (high >= 3500) add('microspikes', 'recommended', 'Snow and ice all year at this height');
  else if (snowfall > 0 || (snowSeason && high >= 1800) || ([5, 10].includes(month) && high >= 2600)) {
    add('microspikes', 'recommended', 'Snow and ice are likely up high this time of year');
  }
  if (sac >= 4 && terrain?.max_sac) {
    add('helmet', sac >= 5 ? 'essential' : 'recommended', `Scrambling and rockfall (SAC ${terrain.max_sac})`);
  }

  // ── Terrain ──
  if (gain >= 700 || hard || multiDay) add('trekking_poles', 'recommended', 'Easier on the knees on steep descents');
  else if (gain >= 400) add('trekking_poles', 'optional', 'Easier on the knees on steep descents');
  if (fords > 0) add('river_shoes', 'recommended', `${plural(fords, 'river crossing')} without a bridge`);
  if (multiDay || hours >= 7) add('water_filter', 'recommended', 'To refill safely from streams');

  // ── Overnight ──
  if (multiDay) {
    add(
      'tent',
      'recommended',
      shelters > 0 ? `Unless you stay in guesthouses or huts (${plural(shelters, 'hut')} mapped on the way)` : 'Unless you stay in guesthouses',
    );
    add('sleeping_bag', 'recommended', high >= 2000 ? 'Nights are cold in the mountains, even in summer' : null);
    add('sleeping_mat', 'recommended', 'Keeps the cold ground away');
    add('stove', 'optional', 'For hot meals and drinks');
    add('cash', 'recommended', 'For guesthouses and transport in villages');
    add('knife', 'optional');
  }

  // ── Small things ──
  if (sunSeason && high < 2200 && hours >= 2) add('insect_repellent', 'optional', 'Ticks live in forests and tall grass');
  add('rubbish_bag', 'recommended', 'Carry out everything you bring');

  const warnings: string[] = [];
  if (multiDay) warnings.push(`A multi-day route: about ${days} days of walking (${Math.round(hours)} h in total).`);
  if (nearBorder) {
    warnings.push(
      'This route comes within 3 km of the state border or the occupation line. Stay on the marked trail, carry your passport and never cross the line.',
    );
  }
  if (high >= 4000) {
    warnings.push(
      `This route reaches ${formatElevation(high)}. Glaciers and altitude need mountaineering gear and experience: consider going with a guide.`,
    );
  }
  if (thunder) warnings.push('Thunderstorms are forecast. Start early and be off exposed ridges by early afternoon.');

  const sorted = [...items.values()].sort(
    (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || DISPLAY_ORDER.indexOf(a.key) - DISPLAY_ORDER.indexOf(b.key),
  );

  return { items: sorted, hours, multiDay, days, maxElevationM: maxElev, summitHighC, summitLowC, warnings };
}

/** Products that cover a gear item, in shop order. */
export function productsForGear<T extends { gear_tags?: string[] }>(products: T[] | undefined, key: GearKey): T[] {
  return (products ?? []).filter((p) => Array.isArray(p.gear_tags) && p.gear_tags.includes(key));
}
