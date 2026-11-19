import { LEVELS, formatXp, hikeXp, levelFor } from '../../utils/xp';

describe('levelFor', () => {
  it('starts everyone as a Newcomer, a tenth of the way at 10 XP', () => {
    expect(levelFor(0)).toEqual({ current: LEVELS[0], next: LEVELS[1], progress: 0, toNext: 100 });
    expect(levelFor(10).progress).toBeCloseTo(0.1);
  });

  it('moves up exactly at each threshold', () => {
    expect(levelFor(99).current.name).toBe('Newcomer');
    expect(levelFor(100).current.name).toBe('Walker');
    expect(levelFor(700).current).toEqual({ level: 4, name: 'Trekker', minXp: 700 });
    expect(levelFor(1100)).toEqual(expect.objectContaining({ progress: 0.5, toNext: 400 }));
  });

  it('stops at the top level', () => {
    expect(levelFor(50000)).toEqual({ current: LEVELS[9], next: null, progress: 1, toNext: null });
  });

  it('treats nonsense as nothing', () => {
    expect(levelFor(-5).current.level).toBe(1);
    expect(levelFor(NaN).current.level).toBe(1);
  });

  it('has levels in rising order', () => {
    LEVELS.forEach((level, i) => {
      expect(level.level).toBe(i + 1);
      if (i > 0) expect(level.minXp).toBeGreaterThan(LEVELS[i - 1].minXp);
    });
  });
});

describe('hikeXp', () => {
  it('gives 100, plus 10 per km and 1 per 10 m climbed, like the server', () => {
    expect(hikeXp(12.4, 860)).toBe(100 + 124 + 86);
    expect(hikeXp(null, null)).toBe(100);
    expect(hikeXp(3.25, 95)).toBe(100 + 33 + 9);
  });
});

it('writes XP with thousands separators', () => {
  expect(formatXp(1240)).toBe('1,240 XP');
});
