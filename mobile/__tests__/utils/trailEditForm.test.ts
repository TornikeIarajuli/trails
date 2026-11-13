import { buildTrailUpdate, parseDecimalInput, trailToForm } from '../../utils/trailEditForm';

const trail = {
  name_en: 'Gergeti Trinity Church',
  name_ka: 'გერგეტის სამება',
  description_en: 'Short climb above Stepantsminda.',
  description_ka: null,
  difficulty: 'easy' as const,
  region: 'Kazbegi',
  distance_km: 6.5,
  elevation_gain_m: 450,
  estimated_hours: 2.5,
  cover_image_url: 'https://example.com/cover.webp',
};

describe('parseDecimalInput', () => {
  it('reads dots and commas as the decimal separator', () => {
    expect(parseDecimalInput('12.5')).toBe(12.5);
    expect(parseDecimalInput('12,5')).toBe(12.5);
    expect(parseDecimalInput(' 7 ')).toBe(7);
  });

  it('returns null for an empty field', () => {
    expect(parseDecimalInput('')).toBeNull();
    expect(parseDecimalInput('   ')).toBeNull();
  });

  it('returns undefined for anything that is not a non-negative number', () => {
    expect(parseDecimalInput('abc')).toBeUndefined();
    expect(parseDecimalInput('-3')).toBeUndefined();
    expect(parseDecimalInput('1.2.3')).toBeUndefined();
    expect(parseDecimalInput('12,')).toBeUndefined();
  });
});

describe('buildTrailUpdate', () => {
  it('sends nothing when nothing changed', () => {
    expect(buildTrailUpdate(trail, trailToForm(trail))).toEqual({ ok: true, data: {} });
  });

  it('sends null for an optional field that was emptied', () => {
    const form = { ...trailToForm(trail), nameKa: '  ', distanceKm: '', coverImageUrl: '' };
    expect(buildTrailUpdate(trail, form)).toEqual({
      ok: true,
      data: { name_ka: null, distance_km: null, cover_image_url: null },
    });
  });

  it('parses a comma decimal and rounds the elevation to whole metres', () => {
    const form = { ...trailToForm(trail), distanceKm: '7,25', elevationGainM: '480,6' };
    expect(buildTrailUpdate(trail, form)).toEqual({
      ok: true,
      data: { distance_km: 7.25, elevation_gain_m: 481 },
    });
  });

  it('requires an English name and a region', () => {
    expect(buildTrailUpdate(trail, { ...trailToForm(trail), nameEn: '  ' })).toMatchObject({ ok: false });
    expect(buildTrailUpdate(trail, { ...trailToForm(trail), region: '' })).toMatchObject({ ok: false });
  });

  it('rejects a number field that is not a number', () => {
    const result = buildTrailUpdate(trail, { ...trailToForm(trail), estimatedHours: 'two' });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/Hours/) });
  });

  it('trims text and sends changed values only', () => {
    const form = { ...trailToForm(trail), nameEn: '  Gergeti Trinity  ', descKa: 'მოკლე ასვლა' };
    expect(buildTrailUpdate(trail, form)).toEqual({
      ok: true,
      data: { name_en: 'Gergeti Trinity', description_ka: 'მოკლე ასვლა' },
    });
  });
});

describe('trailToForm', () => {
  it('turns nulls into empty fields', () => {
    const form = trailToForm({ ...trail, name_ka: null, distance_km: null });
    expect(form.nameKa).toBe('');
    expect(form.distanceKm).toBe('');
    expect(form.elevationGainM).toBe('450');
  });
});
