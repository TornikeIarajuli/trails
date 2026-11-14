import {
  backByOptions,
  formatClock,
  formatFromNow,
  fromPickedTime,
  oneHourLater,
  roundUpToHalfHour,
  suggestedBackBy,
} from '../../utils/backBy';

// Local times, so the tests do not depend on the machine's time zone
const at = (h: number, m = 0, day = 14) => new Date(2026, 10, day, h, m, 0, 0);

describe('back-by times', () => {
  it('rounds up to the next half hour', () => {
    expect(roundUpToHalfHour(at(15, 5))).toEqual(at(15, 30));
    expect(roundUpToHalfHour(at(15, 31))).toEqual(at(16, 0));
    expect(roundUpToHalfHour(at(15, 30))).toEqual(at(15, 30));
  });

  it('suggests the estimated hours and half as much again, at least two hours', () => {
    expect(suggestedBackBy(at(9, 10), 4)).toEqual(at(15, 30)); // 6 h later, rounded up
    expect(suggestedBackBy(at(9, 0), 0.5)).toEqual(at(11, 0)); // at least 2 h
    expect(suggestedBackBy(at(9, 0), null)).toEqual(at(13, 30)); // unknown: 3 h × 1.5
  });

  it('offers the suggestion first and round choices after it, without repeating it', () => {
    const options = backByOptions(at(9, 0), 1.2); // suggestion: 11:00, the same as "In 2 h"
    expect(options.map((o) => o.key)).toEqual(['suggested', '+4', '+6', '+8']);
    expect(options[0].label).toBe('11:00 (suggested)');
  });

  it('takes a picked time as today, or tomorrow once it has passed', () => {
    expect(fromPickedTime(at(9, 0), at(18, 30, 1))).toEqual(at(18, 30));
    expect(fromPickedTime(at(19, 0), at(7, 0, 1))).toEqual(at(7, 0, 15));
  });

  it('reads as a clock time and as time from now', () => {
    expect(formatClock(at(7, 5))).toBe('07:05');
    expect(formatFromNow(at(9, 0), at(9, 45))).toBe('in 45 min');
    expect(formatFromNow(at(9, 0), at(13, 0))).toBe('in 4 h');
    expect(formatFromNow(at(9, 0), at(13, 30))).toBe('in 4 h 30 min');
    expect(formatFromNow(at(20, 0), at(9, 0, 15))).toBe('tomorrow at 09:00');
  });

  it('adds an hour to the later of now and the back-by time', () => {
    expect(oneHourLater(at(17, 0), at(16, 0))).toEqual(at(18, 0));
    expect(oneHourLater(at(15, 0), at(16, 0))).toEqual(at(17, 0));
  });
});
