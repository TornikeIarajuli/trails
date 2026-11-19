import { periodStart, xpWindows } from './xp';

describe('xpWindows (Georgian time, UTC+4)', () => {
  it('starts the week on Monday 00:00 and the month on the 1st, in Tbilisi', () => {
    // Thursday 20 Nov 2026, 10:00 in Tbilisi
    expect(xpWindows(new Date('2026-11-20T06:00:00Z'))).toEqual({
      weekStart: '2026-11-15T20:00:00.000Z', // Monday 16 Nov, 00:00 in Tbilisi
      monthStart: '2026-10-31T20:00:00.000Z', // 1 Nov, 00:00 in Tbilisi
    });
  });

  it('counts Sunday night in Georgia as the old week, and Monday 00:30 as the new one', () => {
    // Sunday 22 Nov, 23:30 in Tbilisi
    expect(xpWindows(new Date('2026-11-22T19:30:00Z')).weekStart).toBe('2026-11-15T20:00:00.000Z');
    // Monday 23 Nov, 00:30 in Tbilisi (still Sunday in UTC)
    expect(xpWindows(new Date('2026-11-22T20:30:00Z')).weekStart).toBe('2026-11-22T20:00:00.000Z');
  });

  it('turns the month over at Georgian midnight', () => {
    // 1 Dec, 01:00 in Tbilisi (30 Nov in UTC)
    expect(xpWindows(new Date('2026-11-30T21:00:00Z')).monthStart).toBe('2026-11-30T20:00:00.000Z');
  });

  it('gives no start for all time', () => {
    const now = new Date('2026-11-20T06:00:00Z');
    expect(periodStart('all', now)).toBeNull();
    expect(periodStart('week', now)).toBe('2026-11-15T20:00:00.000Z');
    expect(periodStart('month', now)).toBe('2026-10-31T20:00:00.000Z');
  });
});
