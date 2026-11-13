import {
  checkpointProfile,
  elevationScale,
  elevationStats,
  normaliseProfile,
  smoothAreaPath,
  smoothLinePath,
  toChartPoints,
} from '../../utils/elevationProfile';
import type { Checkpoint } from '../../types/checkpoint';

const pts = (pairs: [number, number][]) => pairs.map(([distance, elevation]) => ({ distance, elevation }));

const checkpoint = (sort: number, elevation: number | null, lngLat?: [number, number]): Checkpoint => ({
  id: `cp${sort}`,
  trail_id: 't1',
  name_en: `CP ${sort}`,
  name_ka: null,
  description_en: null,
  description_ka: null,
  type: 'viewpoint',
  coordinates: lngLat ? { type: 'Point', coordinates: lngLat } : null,
  elevation_m: elevation,
  photo_url: null,
  sort_order: sort,
  is_checkable: false,
});

describe('normaliseProfile', () => {
  it('reads [distance, elevation] pairs', () => {
    expect(normaliseProfile([[0, 1200], [1800, 1250], [3600, 1294]])).toEqual(pts([[0, 1200], [1800, 1250], [3600, 1294]]));
  });

  it('drops invalid pairs, sorts by distance and drops repeated distances', () => {
    const raw = [[1800, 1250], ['x', 1], [0, 1200], [null, 3], [1800, 9999], [-5, 10], [3600], [3600, 1294]];
    expect(normaliseProfile(raw)).toEqual(pts([[0, 1200], [1800, 1250], [3600, 1294]]));
  });

  it('returns nothing for a missing or one-point profile', () => {
    expect(normaliseProfile(null)).toEqual([]);
    expect(normaliseProfile(undefined)).toEqual([]);
    expect(normaliseProfile('[]')).toEqual([]);
    expect(normaliseProfile([[0, 1200]])).toEqual([]);
  });
});

describe('elevationScale', () => {
  it('widens a gentle trail to a 200 m window around its middle', () => {
    // e.g. Mokoland: 3.6 km with under 100 m of climbing
    expect(elevationScale(pts([[0, 1000], [1800, 1060], [3600, 1094]]))).toEqual({ lo: 947, hi: 1147 });
  });

  it('keeps the range of a trail that climbs more than 200 m', () => {
    expect(elevationScale(pts([[0, 1700], [5000, 2450], [9000, 1900]]))).toEqual({ lo: 1700, hi: 2450 });
  });

  it('gives a flat trail the full minimum window', () => {
    expect(elevationScale(pts([[0, 500], [1000, 500]]))).toEqual({ lo: 400, hi: 600 });
  });

  it('does not go below sea level for low trails', () => {
    expect(elevationScale(pts([[0, 5], [1000, 40]]))).toEqual({ lo: 0, hi: 200 });
  });
});

describe('elevationStats', () => {
  it('ignores ups and downs smaller than 10 m', () => {
    expect(elevationStats(pts([[0, 100], [100, 105], [200, 100], [300, 104], [400, 99]]))).toMatchObject({
      ascent: 0,
      descent: 0,
    });
  });

  it('adds up climbs and descents', () => {
    expect(elevationStats(pts([[0, 100], [500, 150], [1000, 120], [1500, 200]]))).toEqual({
      min: 100,
      max: 200,
      ascent: 130,
      descent: 30,
      distance: 1500,
    });
  });

  it('counts a slow steady climb', () => {
    const steady = pts(Array.from({ length: 11 }, (_, i) => [i * 100, 1000 + i * 4] as [number, number]));
    expect(elevationStats(steady).ascent).toBe(36);
  });
});

describe('toChartPoints', () => {
  it('maps the route onto the chart area', () => {
    const scale = { lo: 900, hi: 1100 };
    const chart = toChartPoints(pts([[0, 900], [500, 1000], [1000, 1100]]), scale, 300, 120);
    expect(chart).toEqual([
      { x: 0, y: 120 },
      { x: 150, y: 60 },
      { x: 300, y: 0 },
    ]);
  });

  it('draws a gentle trail as a gentle line', () => {
    const points = pts([[0, 1000], [3600, 1094]]);
    const chart = toChartPoints(points, elevationScale(points), 300, 120);
    // 94 m in a 200 m window: under half the chart height
    expect(chart[0].y - chart[1].y).toBeCloseTo((94 / 200) * 120);
  });
});

describe('smoothLinePath', () => {
  const numbers = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number);

  it('draws one curve segment per pair of points', () => {
    const d = smoothLinePath([{ x: 0, y: 100 }, { x: 50, y: 60 }, { x: 100, y: 80 }]);
    expect(d.startsWith('M0,100')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(2);
  });

  it('never overshoots the data (no invented peaks or dips)', () => {
    const chart = [
      { x: 0, y: 110 }, { x: 40, y: 20 }, { x: 80, y: 100 },
      { x: 120, y: 95 }, { x: 160, y: 10 }, { x: 200, y: 60 },
    ];
    const ys = numbers(smoothLinePath(chart)).filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...ys)).toBeLessThanOrEqual(110);
  });

  it('handles degenerate input', () => {
    expect(smoothLinePath([])).toBe('');
    expect(smoothLinePath([{ x: 3, y: 4 }])).toBe('M3,4');
  });
});

describe('smoothAreaPath', () => {
  it('closes the curve along the bottom edge', () => {
    const d = smoothAreaPath([{ x: 0, y: 50 }, { x: 100, y: 20 }], 120);
    expect(d.endsWith('L100,120 L0,120 Z')).toBe(true);
  });

  it('is empty for fewer than two points', () => {
    expect(smoothAreaPath([{ x: 0, y: 0 }], 120)).toBe('');
  });
});

describe('checkpointProfile', () => {
  it('needs at least three checkpoints with an elevation', () => {
    expect(checkpointProfile([checkpoint(0, 1200), checkpoint(1, 1300)], 3.6)).toEqual([]);
    expect(checkpointProfile([checkpoint(0, 1200), checkpoint(1, null), checkpoint(2, 1300)], 3.6)).toEqual([]);
  });

  it('places checkpoints by the distance between their coordinates', () => {
    const profile = checkpointProfile(
      [
        checkpoint(2, 1400, [44.62, 42.68]),
        checkpoint(0, 1200, [44.6, 42.66]),
        checkpoint(1, 1300, [44.61, 42.67]),
      ],
      5,
    );
    expect(profile.map((p) => p.elevation)).toEqual([1200, 1300, 1400]);
    expect(profile[0].distance).toBe(0);
    expect(profile[1].distance).toBeGreaterThan(1000);
    expect(profile[2].distance).toBeGreaterThan(profile[1].distance);
  });

  it('spreads checkpoints evenly over the trail when coordinates are missing', () => {
    const profile = checkpointProfile([checkpoint(0, 1200), checkpoint(1, 1300), checkpoint(2, 1250)], 4);
    expect(profile).toEqual(pts([[0, 1200], [2000, 1300], [4000, 1250]]));
  });
});
