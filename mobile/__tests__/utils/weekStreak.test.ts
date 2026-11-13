import { bestWeekStreak, isoWeekIndex } from '../../utils/weekStreak';

// Local-time dates, as the app sees them
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

describe('isoWeekIndex', () => {
  it('puts Monday to Sunday in the same week', () => {
    const monday = isoWeekIndex(day(2026, 11, 9));
    expect(isoWeekIndex(day(2026, 11, 15))).toBe(monday); // Sunday
    expect(isoWeekIndex(day(2026, 11, 16))).toBe(monday + 1); // next Monday
  });

  it('keeps counting across the new year', () => {
    // 29 Dec 2025 (Mon) and 5 Jan 2026 (Mon) are consecutive ISO weeks
    expect(isoWeekIndex(day(2026, 1, 5)) - isoWeekIndex(day(2025, 12, 29))).toBe(1);
  });
});

describe('bestWeekStreak', () => {
  it('is 0 without hikes', () => {
    expect(bestWeekStreak([])).toBe(0);
  });

  it('counts several hikes in one week once', () => {
    expect(bestWeekStreak([day(2026, 3, 2), day(2026, 3, 4), day(2026, 3, 8)])).toBe(1);
  });

  it('counts consecutive weeks', () => {
    expect(bestWeekStreak([day(2026, 3, 2), day(2026, 3, 10), day(2026, 3, 18)])).toBe(3);
  });

  it('chains weeks across a year boundary', () => {
    expect(bestWeekStreak([day(2025, 12, 23), day(2025, 12, 30), day(2026, 1, 7)])).toBe(3);
  });

  it('does not chain week 10 of one year to week 11 of the next', () => {
    // Early March 2025 and early-to-mid March 2026: same week numbers, a year apart
    expect(bestWeekStreak([day(2025, 3, 5), day(2026, 3, 11)])).toBe(1);
  });

  it('returns the longest of several runs', () => {
    const dates = [
      day(2026, 1, 5), day(2026, 1, 12), // run of 2
      day(2026, 2, 2), day(2026, 2, 9), day(2026, 2, 16), day(2026, 2, 23), // run of 4
    ];
    expect(bestWeekStreak(dates)).toBe(4);
  });

  it('accepts ISO strings and skips missing or invalid values', () => {
    expect(bestWeekStreak(['2026-04-01T09:00:00Z', null, undefined, 'not a date', '2026-04-08T09:00:00Z'])).toBe(2);
  });
});
