import { formatDistance, formatDuration, formatElevation, formatPrice } from '../../utils/formatters';

describe('formatPrice', () => {
  it('shows whole amounts without decimals and groups thousands', () => {
    expect(formatPrice(45)).toBe('45 ₾');
    expect(formatPrice(1250)).toBe('1,250 ₾');
  });

  it('shows fractional amounts with two decimals', () => {
    expect(formatPrice(49.9)).toBe('49.90 ₾');
    expect(formatPrice(1234.5)).toBe('1,234.50 ₾');
  });

  it('accepts numeric strings (Postgres numeric columns arrive as strings)', () => {
    expect(formatPrice('120.00')).toBe('120 ₾');
  });

  it('returns an empty string for missing or invalid prices', () => {
    expect(formatPrice(null)).toBe('');
    expect(formatPrice(undefined)).toBe('');
    expect(formatPrice('')).toBe('');
    expect(formatPrice('free')).toBe('');
  });
});

describe('formatters with missing values', () => {
  it('show a dash for null and undefined', () => {
    expect(formatDistance(undefined)).toBe('--');
    expect(formatElevation(null)).toBe('--');
    expect(formatDuration(undefined)).toBe('--');
  });
});
