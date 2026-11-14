import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { normalizeInstagramHandle } from './instagram';
import { UpdateProfileDto } from './dto/update-profile.dto';

describe('normalizeInstagramHandle', () => {
  it('keeps the plain username from what people paste', () => {
    expect(normalizeInstagramHandle('nino_hikes')).toBe('nino_hikes');
    expect(normalizeInstagramHandle('@nino.hikes')).toBe('nino.hikes');
    expect(normalizeInstagramHandle('  @@nino  ')).toBe('nino');
    expect(
      normalizeInstagramHandle('https://www.instagram.com/nino_hikes/'),
    ).toBe('nino_hikes');
    expect(normalizeInstagramHandle('instagram.com/nino_hikes?igsh=abc')).toBe(
      'nino_hikes',
    );
    expect(normalizeInstagramHandle('http://m.instagram.com/Nino')).toBe(
      'Nino',
    );
  });

  it('treats empty as removal and leaves other values for validation', () => {
    expect(normalizeInstagramHandle('   ')).toBeNull();
    expect(normalizeInstagramHandle(null)).toBeNull();
    expect(normalizeInstagramHandle(undefined)).toBeUndefined();
    expect(normalizeInstagramHandle(42)).toBe(42);
  });
});

describe('UpdateProfileDto.instagram_handle', () => {
  const check = async (instagram_handle: unknown) => {
    const dto = plainToInstance(UpdateProfileDto, { instagram_handle });
    const errors = await validate(dto);
    return { value: dto.instagram_handle, ok: errors.length === 0 };
  };

  it('accepts usernames, links and removal', async () => {
    expect(await check('@nino_hikes')).toEqual({
      value: 'nino_hikes',
      ok: true,
    });
    expect(await check('https://instagram.com/nino.hikes')).toEqual({
      value: 'nino.hikes',
      ok: true,
    });
    expect(await check('')).toEqual({ value: null, ok: true });
    expect(await check(null)).toEqual({ value: null, ok: true });
  });

  it('rejects what cannot be an Instagram username', async () => {
    expect((await check('nino hikes')).ok).toBe(false);
    expect((await check('a'.repeat(31))).ok).toBe(false);
    expect((await check('nino-hikes')).ok).toBe(false);
    expect((await check(42)).ok).toBe(false);
  });
});
