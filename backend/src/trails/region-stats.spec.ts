import {
  parsePoint,
  RegionSummary,
  RegionTrail,
  regionProgress,
  summarizeRegions,
} from './region-stats';

const point = (lng: number, lat: number) => ({
  type: 'Point',
  crs: { type: 'name', properties: { name: 'EPSG:4326' } },
  coordinates: [lng, lat],
});

const trail = (
  id: string,
  region: unknown,
  start_point: unknown = null,
): RegionTrail => ({ id, region, start_point });

describe('parsePoint', () => {
  it('reads a GeoJSON point and ignores crs', () => {
    expect(parsePoint(point(44.6, 42.66))).toEqual([44.6, 42.66]);
  });

  it('reads GeoJSON text', () => {
    expect(
      parsePoint(JSON.stringify({ type: 'Point', coordinates: [44.6, 42.66] })),
    ).toEqual([44.6, 42.66]);
  });

  it.each([
    null,
    undefined,
    'not json',
    '0101000020E6100000',
    { type: 'LineString', coordinates: [[44.6, 42.66]] },
    { type: 'Point', coordinates: [200, 42.66] },
    { type: 'Point', coordinates: [44.6, 95] },
    { type: 'Point', coordinates: ['44.6', 42.66] },
    { type: 'Point' },
  ])('returns null for %p', (value) => {
    expect(parsePoint(value)).toBeNull();
  });
});

describe('summarizeRegions', () => {
  it('counts trails per region and averages their trailheads', () => {
    const summaries = summarizeRegions([
      trail('t1', 'Khevsureti', point(45.0, 42.5)),
      trail('t2', 'Khevsureti', point(45.2, 42.7)),
      trail('t3', 'Svaneti', point(42.7, 43.0)),
    ]);

    expect(summaries).toEqual([
      {
        region: 'Khevsureti',
        total: 2,
        center: [45.1, 42.6],
        trailIds: ['t1', 't2'],
      },
      { region: 'Svaneti', total: 1, center: [42.7, 43], trailIds: ['t3'] },
    ]);
  });

  it('groups regions exactly as stored', () => {
    const summaries = summarizeRegions([
      trail('t1', 'Svaneti'),
      trail('t2', 'svaneti'),
      trail('t3', 'Svaneti '),
    ]);

    expect(summaries.map((s) => s.region).sort()).toEqual([
      'Svaneti',
      'Svaneti ',
      'svaneti',
    ]);
    expect(summaries.every((s) => s.total === 1)).toBe(true);
  });

  it('sorts by number of trails, then by name', () => {
    const summaries = summarizeRegions([
      trail('t1', 'Tusheti'),
      trail('t2', 'Kazbegi'),
      trail('t3', 'Svaneti'),
      trail('t4', 'Svaneti'),
      trail('t5', 'Adjara'),
    ]);

    expect(summaries.map((s) => s.region)).toEqual([
      'Svaneti',
      'Adjara',
      'Kazbegi',
      'Tusheti',
    ]);
  });

  it('averages only the trailheads it can read and is null without any', () => {
    const summaries = summarizeRegions([
      trail('t1', 'Racha', point(43.0, 42.5)),
      trail('t2', 'Racha', null),
      trail('t3', 'Racha', 'garbage'),
      trail('t4', 'Kakheti', null),
    ]);

    const racha = summaries.find((s) => s.region === 'Racha');
    const kakheti = summaries.find((s) => s.region === 'Kakheti');
    expect(racha).toMatchObject({ total: 3, center: [43, 42.5] });
    expect(kakheti).toMatchObject({ total: 1, center: null });
  });

  it('rounds the center to six decimals', () => {
    const [summary] = summarizeRegions([
      trail('t1', 'Kazbegi', point(44.1234561, 42.1)),
      trail('t2', 'Kazbegi', point(44.1234562, 42.2)),
      trail('t3', 'Kazbegi', point(44.1234563, 42.3)),
    ]);
    expect(summary.center).toEqual([44.123456, 42.2]);
  });

  it('skips trails without a region', () => {
    expect(
      summarizeRegions([trail('t1', null), trail('t2', undefined)]),
    ).toEqual([]);
  });

  it('is empty for no trails', () => {
    expect(summarizeRegions([])).toEqual([]);
  });
});

describe('regionProgress', () => {
  const summaries: RegionSummary[] = [
    {
      region: 'Khevsureti',
      total: 3,
      center: [45.1, 42.6],
      trailIds: ['k1', 'k2', 'k3'],
    },
    {
      region: 'Svaneti',
      total: 2,
      center: [42.7, 43],
      trailIds: ['s1', 's2'],
    },
    { region: 'Racha', total: 1, center: null, trailIds: ['r1'] },
  ];

  it('counts completed trails per region and in total', () => {
    const result = regionProgress(summaries, ['k3', 'k1', 's1', 's2']);

    expect(result.regions).toEqual([
      {
        region: 'Khevsureti',
        total: 3,
        completed: 2,
        center: [45.1, 42.6],
        completed_trail_ids: ['k1', 'k3'],
      },
      {
        region: 'Svaneti',
        total: 2,
        completed: 2,
        center: [42.7, 43],
        completed_trail_ids: ['s1', 's2'],
      },
      {
        region: 'Racha',
        total: 1,
        completed: 0,
        center: null,
        completed_trail_ids: [],
      },
    ]);
    expect(result.totals).toEqual({
      regions_total: 3,
      regions_started: 2,
      regions_completed: 1,
      trails_total: 6,
      trails_completed: 4,
    });
  });

  it('ignores completions of unpublished or unknown trails and duplicates', () => {
    const result = regionProgress(summaries, ['k1', 'k1', 'unpublished-trail']);

    expect(result.regions[0].completed).toBe(1);
    expect(result.totals.trails_completed).toBe(1);
    expect(result.totals.regions_started).toBe(1);
  });

  it('reports zero progress for a user without completions', () => {
    const result = regionProgress(summaries, []);

    expect(result.regions.every((r) => r.completed === 0)).toBe(true);
    expect(result.totals).toEqual({
      regions_total: 3,
      regions_started: 0,
      regions_completed: 0,
      trails_total: 6,
      trails_completed: 0,
    });
  });

  it('does not change the cached summaries', () => {
    const snapshot = JSON.stringify(summaries);
    regionProgress(summaries, ['k1', 's1']);
    expect(JSON.stringify(summaries)).toBe(snapshot);
  });

  it('handles no regions at all', () => {
    expect(regionProgress([], ['k1'])).toEqual({
      regions: [],
      totals: {
        regions_total: 0,
        regions_started: 0,
        regions_completed: 0,
        trails_total: 0,
        trails_completed: 0,
      },
    });
  });
});
