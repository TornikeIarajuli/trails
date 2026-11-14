import { formatKm, terrainRows, terrainSource } from '../../utils/terrainSummary';
import type { TrailTerrain } from '../../types/trail';

const terrain = (extra: Partial<TrailTerrain> = {}): TrailTerrain => ({
  source: 'osm',
  fetched_at: '2026-11-13',
  coverage: 1,
  max_sac: 'T3',
  sac_km: { T1: 11.8, T2: 4.4, T3: 3.6 },
  surfaces_km: { ground: 13.8 },
  fords: 24,
  water_points: 3,
  shelters: 4,
  ...extra,
});

describe('terrainRows', () => {
  it('describes a mountain trail: grade, ground, crossings, water and huts', () => {
    const rows = terrainRows(terrain());
    expect(rows.map((r) => r.key)).toEqual(['grade', 'ground', 'fords', 'water', 'shelters']);
    expect(rows.map((r) => r.title)).toEqual([
      'Demanding mountain path (T3)',
      'Mostly dirt path',
      '24 river crossings without a bridge',
      '3 springs or taps near the route',
      '4 huts or shelters near the route',
    ]);
  });

  it('shows how much of the route is at each grade, easy to hard', () => {
    const grade = terrainRows(terrain())[0];
    expect(grade.detail).toBe('T1 12 km · T2 4.4 km · T3 3.6 km');
    expect(grade.bar?.map((p) => p.key)).toEqual(['T1', 'T2', 'T3']);
  });

  it('calls ground mixed when no surface makes most of it, longest first', () => {
    const ground = terrainRows(terrain({ surfaces_km: { gravel: 3, ground: 5, paved: 1.2 } }))[1];
    expect(ground.title).toBe('Mixed ground');
    expect(ground.detail).toBe('Dirt path 5 km · Gravel 3 km · Paved 1.2 km');
    expect(ground.bar?.map((p) => p.key)).toEqual(['ground', 'gravel', 'paved']);
  });

  it('says so when no crossings or water are mapped, and leaves out huts when there are none', () => {
    const rows = terrainRows(terrain({ fords: 0, water_points: 0, shelters: 0 }));
    expect(rows.find((r) => r.key === 'fords')?.title).toBe('No river crossings without a bridge mapped');
    expect(rows.find((r) => r.key === 'water')).toEqual(
      expect.objectContaining({ title: 'No springs or taps mapped near the route', detail: 'Carry all the water you need.' }),
    );
    expect(rows.find((r) => r.key === 'shelters')).toBeUndefined();
  });

  it('counts one of a kind in the singular', () => {
    const rows = terrainRows(terrain({ fords: 1, water_points: 1, shelters: 1 }));
    expect(rows.map((r) => r.title).slice(2)).toEqual([
      '1 river crossing without a bridge',
      '1 spring or tap near the route',
      '1 hut or shelter near the route',
    ]);
  });

  it('leaves out the grade when the route has none mapped', () => {
    const rows = terrainRows(terrain({ max_sac: null, sac_km: {} }));
    expect(rows[0].key).toBe('ground');
  });
});

describe('terrainSource', () => {
  it('names the source and the date', () => {
    expect(terrainSource(terrain())).toEqual({ source: 'From OpenStreetMap, 13 November 2026', caution: null });
  });

  it('warns when much of the route is not on mapped paths', () => {
    expect(terrainSource(terrain({ coverage: 0.74 })).caution).toBe(
      'Only 74% of the route follows mapped paths, so there may be more than this.',
    );
  });
});

describe('formatKm', () => {
  it('rounds to a tenth below 10 km and to whole km above', () => {
    expect(formatKm(3.64)).toBe('3.6 km');
    expect(formatKm(13.8)).toBe('14 km');
  });
});
