import type { UpdateTrailData } from '../services/trails';
import type { Trail, TrailDifficulty } from '../types/trail';

export interface TrailEditForm {
  nameEn: string;
  nameKa: string;
  descEn: string;
  descKa: string;
  difficulty: TrailDifficulty;
  region: string;
  distanceKm: string;
  elevationGainM: string;
  estimatedHours: string;
  coverImageUrl: string;
}

type EditableTrail = Pick<
  Trail,
  | 'name_en'
  | 'name_ka'
  | 'description_en'
  | 'description_ka'
  | 'difficulty'
  | 'region'
  | 'distance_km'
  | 'elevation_gain_m'
  | 'estimated_hours'
  | 'cover_image_url'
>;

export function trailToForm(trail: EditableTrail): TrailEditForm {
  return {
    nameEn: trail.name_en ?? '',
    nameKa: trail.name_ka ?? '',
    descEn: trail.description_en ?? '',
    descKa: trail.description_ka ?? '',
    difficulty: trail.difficulty,
    region: trail.region ?? '',
    distanceKm: trail.distance_km != null ? String(trail.distance_km) : '',
    elevationGainM: trail.elevation_gain_m != null ? String(trail.elevation_gain_m) : '',
    estimatedHours: trail.estimated_hours != null ? String(trail.estimated_hours) : '',
    coverImageUrl: trail.cover_image_url ?? '',
  };
}

/**
 * Reads a number typed on a phone keypad, where the decimal separator may be a
 * comma. Returns `null` for an empty field and `undefined` for something that is
 * not a non-negative number.
 */
export function parseDecimalInput(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!/^\d+([.,]\d+)?$/.test(trimmed)) return undefined;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : undefined;
}

export type TrailUpdateResult =
  | { ok: true; data: UpdateTrailData }
  | { ok: false; error: string };

/**
 * The PATCH body for what changed in the form: only changed fields are included,
 * and an optional field that was emptied is sent as `null` so the server clears
 * it (an omitted key would leave the old value in place).
 */
export function buildTrailUpdate(trail: EditableTrail, form: TrailEditForm): TrailUpdateResult {
  const data: UpdateTrailData = {};

  const nameEn = form.nameEn.trim();
  if (!nameEn) return { ok: false, error: 'The English name cannot be empty.' };
  if (nameEn !== trail.name_en) data.name_en = nameEn;

  const region = form.region.trim();
  if (!region) return { ok: false, error: 'The region cannot be empty.' };
  if (region !== trail.region) data.region = region;

  if (form.difficulty !== trail.difficulty) data.difficulty = form.difficulty;

  const optionalText: [keyof TrailEditForm, 'name_ka' | 'description_en' | 'description_ka' | 'cover_image_url'][] = [
    ['nameKa', 'name_ka'],
    ['descEn', 'description_en'],
    ['descKa', 'description_ka'],
    ['coverImageUrl', 'cover_image_url'],
  ];
  for (const [formKey, field] of optionalText) {
    const value = (form[formKey] as string).trim() || null;
    if (value !== (trail[field] ?? null)) data[field] = value;
  }

  const numbers: [keyof TrailEditForm, 'distance_km' | 'elevation_gain_m' | 'estimated_hours', string][] = [
    ['distanceKm', 'distance_km', 'Distance'],
    ['elevationGainM', 'elevation_gain_m', 'Elevation'],
    ['estimatedHours', 'estimated_hours', 'Hours'],
  ];
  for (const [formKey, field, label] of numbers) {
    const parsed = parseDecimalInput(form[formKey] as string);
    if (parsed === undefined) return { ok: false, error: `${label} must be a number, for example 12.5.` };
    // Elevation is a whole number of metres in the database
    const value = parsed !== null && field === 'elevation_gain_m' ? Math.round(parsed) : parsed;
    if (value !== (trail[field] ?? null)) data[field] = value;
  }

  return { ok: true, data };
}
