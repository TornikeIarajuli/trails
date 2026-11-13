import {
  filterTrailsToRegion,
  progressColors,
  progressRatio,
  regionFraction,
  regionsHeaderText,
  sortRegions,
} from '../../utils/regionProgress';
import type { RegionProgress } from '../../types/regions';

const region = (name: string, completed: number, total: number): RegionProgress => ({
  region: name,
  completed,
  total,
  center: null,
  completed_trail_ids: [],
});

describe('progressRatio', () => {
  it('is the share of trails done, capped to 0..1', () => {
    expect(progressRatio(3, 12)).toBe(0.25);
    expect(progressRatio(5, 4)).toBe(1);
    expect(progressRatio(0, 0)).toBe(0);
    expect(progressRatio(NaN, 10)).toBe(0);
  });
});

describe('progressColors', () => {
  it('is neutral grey when nothing is hiked', () => {
    expect(progressColors(0, 14).background).toBe('#CFD8DC');
    expect(progressColors(0, 0).background).toBe('#CFD8DC');
  });

  it('is gold when every trail is done', () => {
    expect(progressColors(14, 14).background).toBe('#F9A825');
  });

  it('deepens the green as more trails are done', () => {
    const light = progressColors(1, 10).background;
    const dark = progressColors(9, 10).background;
    expect(light).not.toBe(dark);
    // Darker green: lower sum of RGB channels
    const brightness = (hex: string) => [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0);
    expect(brightness(dark)).toBeLessThan(brightness(light));
  });

  it('uses readable text on each background', () => {
    expect(progressColors(1, 10).text).toBe('#263238');
    expect(progressColors(9, 10).text).toBe('#FFFFFF');
  });
});

describe('regionsHeaderText', () => {
  it('summarises regions and trails', () => {
    expect(
      regionsHeaderText({
        regions_total: 15,
        regions_started: 4,
        regions_completed: 1,
        trails_total: 209,
        trails_completed: 12,
      }),
    ).toBe('4 of 15 regions explored · 12 of 209 trails');
  });

  it('is empty without totals', () => {
    expect(regionsHeaderText(null)).toBe('');
  });
});

describe('regionFraction', () => {
  it('reads like "3/14"', () => {
    expect(regionFraction({ completed: 3, total: 14 })).toBe('3/14');
  });
});

describe('sortRegions', () => {
  it('puts the most complete regions first, then the rest by name', () => {
    const sorted = sortRegions([
      region('Tusheti', 0, 6),
      region('Khevsureti', 3, 14),
      region('Adjara', 0, 9),
      region('Kazbegi', 7, 7),
    ]);
    expect(sorted.map((r) => r.region)).toEqual(['Kazbegi', 'Khevsureti', 'Adjara', 'Tusheti']);
  });
});

describe('filterTrailsToRegion', () => {
  it('keeps only trails of exactly that region', () => {
    const trails = [
      { id: '1', region: 'Kakheti' },
      { id: '2', region: 'Inner Kakheti' },
      { id: '3', region: ' kakheti ' },
      { id: '4', region: null },
    ];
    expect(filterTrailsToRegion(trails, 'Kakheti').map((t) => t.id)).toEqual(['1', '3']);
  });
});
