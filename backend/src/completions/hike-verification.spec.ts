import {
  distanceMeters,
  HikeThresholds,
  parseRouteCoordinates,
  trackDurationSeconds,
  verifyHike,
} from './hike-verification';

const THRESHOLDS: HikeThresholds = {
  toleranceM: 120,
  minCoverage: 0.6,
  maxSpeedKmh: 15,
};

// Meters per degree of latitude, and of longitude near Kazbegi (42.66 N)
const M_PER_DEG_LAT = 111_195;
const M_PER_DEG_LNG = 111_195 * Math.cos((42.66 * Math.PI) / 180);

const START = { lat: 42.66, lng: 44.6 };
const T0 = 1_794_553_200; // 2026-11-13T07:00:00Z

/** A straight route heading north from START: `count` vertices `spacingM` apart. */
function northRoute(count: number, spacingM = 50): Array<[number, number]> {
  return Array.from({ length: count }, (_, i) => [
    START.lng,
    START.lat + (i * spacingM) / M_PER_DEG_LAT,
  ]);
}

/**
 * A track along the same line, shifted `offsetEastM` to the east, with one point every
 * `spacingM` and `secondsPerPoint` between points. Covers `fraction` of `lengthM`.
 */
function northTrack(
  lengthM: number,
  {
    spacingM = 20,
    offsetEastM = 0,
    fraction = 1,
    secondsPerPoint = 15,
  }: {
    spacingM?: number;
    offsetEastM?: number;
    fraction?: number;
    secondsPerPoint?: number;
  } = {},
): Array<[number, number, number]> {
  const count = Math.floor((lengthM * fraction) / spacingM) + 1;
  return Array.from({ length: count }, (_, i) => [
    START.lat + (i * spacingM) / M_PER_DEG_LAT,
    START.lng + offsetEastM / M_PER_DEG_LNG,
    T0 + i * secondsPerPoint,
  ]);
}

describe('distanceMeters', () => {
  it('measures one degree of latitude as about 111 km', () => {
    expect(distanceMeters(42, 44, 43, 44)).toBeCloseTo(111_195, -1);
  });

  it('shrinks degrees of longitude with the latitude', () => {
    const atEquator = distanceMeters(0, 44, 0, 45);
    const inGeorgia = distanceMeters(42.66, 44, 42.66, 45);
    expect(inGeorgia / atEquator).toBeCloseTo(
      Math.cos((42.66 * Math.PI) / 180),
      3,
    );
  });

  it('is zero for the same point', () => {
    expect(distanceMeters(42.66, 44.6, 42.66, 44.6)).toBe(0);
  });
});

describe('parseRouteCoordinates', () => {
  const coordinates = [
    [44.6145986, 42.6654914],
    [44.6146712, 42.6656082],
  ];

  it('reads a GeoJSON LineString object', () => {
    expect(parseRouteCoordinates({ type: 'LineString', coordinates })).toEqual(
      coordinates,
    );
  });

  it('ignores the crs member PostgREST adds', () => {
    const geometry = {
      type: 'LineString',
      crs: { type: 'name', properties: { name: 'EPSG:4326' } },
      coordinates,
    };
    expect(parseRouteCoordinates(geometry)).toEqual(coordinates);
  });

  it('reads GeoJSON text', () => {
    expect(
      parseRouteCoordinates(
        JSON.stringify({ type: 'LineString', coordinates }),
      ),
    ).toEqual(coordinates);
  });

  it('drops altitude and invalid positions', () => {
    const geometry = {
      type: 'LineString',
      coordinates: [
        [44.6, 42.6, 1794],
        [200, 42.6],
        [44.6, 95],
        ['44.6', 42.6],
        [44.7],
        null,
        [44.8, 42.8],
      ],
    };
    expect(parseRouteCoordinates(geometry)).toEqual([
      [44.6, 42.6],
      [44.8, 42.8],
    ]);
  });

  it.each([
    null,
    undefined,
    '',
    'not json',
    '0102000020E6100000',
    42,
    { type: 'Point', coordinates: [44.6, 42.6] },
    { type: 'LineString' },
    { type: 'LineString', coordinates: 'nope' },
  ])('returns [] for %p', (value) => {
    expect(parseRouteCoordinates(value)).toEqual([]);
  });
});

describe('trackDurationSeconds', () => {
  it('spans the earliest to the latest timestamp, in any order', () => {
    expect(
      trackDurationSeconds([
        [42.6, 44.6, T0 + 600],
        [42.6, 44.6, T0],
        [42.6, 44.6, T0 + 5400],
        [42.6, 44.6, T0 + 60],
      ]),
    ).toBe(5400);
  });

  it('is null without usable timestamps', () => {
    expect(trackDurationSeconds([])).toBeNull();
    expect(trackDurationSeconds(null)).toBeNull();
    expect(trackDurationSeconds([[42.6, 44.6, NaN]])).toBeNull();
  });
});

describe('verifyHike', () => {
  // 3 km route, 61 vertices 50 m apart
  const route = northRoute(61);
  const lengthM = 3000;
  const base = {
    route,
    trailDistanceKm: 3,
    thresholds: THRESHOLDS,
  };

  it('verifies a track that walks the whole route at a normal pace', () => {
    const result = verifyHike({ ...base, track: northTrack(lengthM) });
    expect(result).toEqual({ verified: true, coverage: 1, reason: 'ok' });
  });

  it('tolerates GPS error within the tolerance', () => {
    const result = verifyHike({
      ...base,
      track: northTrack(lengthM, { offsetEastM: 100 }),
    });
    expect(result.reason).toBe('ok');
    expect(result.coverage).toBe(1);
  });

  it('does not count vertices farther than the tolerance', () => {
    const result = verifyHike({
      ...base,
      track: northTrack(lengthM, { offsetEastM: 200 }),
    });
    expect(result).toEqual({
      verified: false,
      coverage: 0,
      reason: 'low_coverage',
    });
  });

  it('rejects a hike that stopped halfway', () => {
    const result = verifyHike({
      ...base,
      track: northTrack(lengthM, { fraction: 0.5 }),
    });
    expect(result.verified).toBe(false);
    expect(result.reason).toBe('low_coverage');
    // vertices 0..30 lie on the walked half, 31 and 32 within 120 m of its end
    expect(result.coverage).toBeCloseTo(33 / 61, 3);
  });

  it('accepts coverage exactly at the threshold', () => {
    // 10 vertices; the track reaches the first 6 of them only
    const shortRoute = northRoute(10, 500);
    const track = northTrack(2500, { spacingM: 50 });
    const result = verifyHike({
      route: shortRoute,
      trailDistanceKm: 4.5,
      track,
      elapsedSeconds: 3600,
      thresholds: THRESHOLDS,
    });
    expect(result.coverage).toBe(0.6);
    expect(result.reason).toBe('ok');
  });

  it('uses the configured coverage threshold', () => {
    const track = northTrack(lengthM, { fraction: 0.5 });
    const lenient = verifyHike({
      ...base,
      track,
      thresholds: { ...THRESHOLDS, minCoverage: 0.5 },
    });
    expect(lenient.reason).toBe('ok');
  });

  it('works for an out-and-back route walked in either direction', () => {
    const outAndBack = [...route, ...[...route].reverse()];
    const reversedTrack = northTrack(lengthM)
      .reverse()
      .map(([lat, lng], i): [number, number, number] => [
        lat,
        lng,
        T0 + i * 15,
      ]);
    const result = verifyHike({
      ...base,
      route: outAndBack,
      trailDistanceKm: 6,
      track: reversedTrack,
      elapsedSeconds: 7200,
    });
    expect(result).toEqual({ verified: true, coverage: 1, reason: 'ok' });
  });

  describe('speed', () => {
    it('rejects an average speed above the limit (from elapsed_seconds)', () => {
      // 3 km in 10 minutes = 18 km/h
      const result = verifyHike({
        ...base,
        track: northTrack(lengthM),
        elapsedSeconds: 600,
      });
      expect(result).toEqual({
        verified: false,
        coverage: 1,
        reason: 'too_fast',
      });
    });

    it('accepts exactly the speed limit', () => {
      // 3 km in 12 minutes = 15 km/h
      const result = verifyHike({
        ...base,
        track: northTrack(lengthM),
        elapsedSeconds: 720,
      });
      expect(result.reason).toBe('ok');
    });

    it('derives the elapsed time from the track when elapsed_seconds is missing', () => {
      // 151 points 5 s apart: 750 s for 3 km = 14.4 km/h
      const ok = verifyHike({
        ...base,
        track: northTrack(lengthM, { secondsPerPoint: 5 }),
      });
      expect(ok.reason).toBe('ok');

      // 151 points 4 s apart: 600 s for 3 km = 18 km/h
      const tooFast = verifyHike({
        ...base,
        track: northTrack(lengthM, { secondsPerPoint: 4 }),
        elapsedSeconds: null,
      });
      expect(tooFast.reason).toBe('too_fast');
    });

    it('treats elapsed_seconds = 0 as missing', () => {
      const result = verifyHike({
        ...base,
        track: northTrack(lengthM, { secondsPerPoint: 15 }),
        elapsedSeconds: 0,
      });
      expect(result.reason).toBe('ok');
    });

    it('prefers the reported elapsed_seconds over the track timestamps', () => {
      const result = verifyHike({
        ...base,
        track: northTrack(lengthM, { secondsPerPoint: 1 }),
        elapsedSeconds: 3600,
      });
      expect(result.reason).toBe('ok');
    });

    it('rejects a hike that took no time at all', () => {
      const result = verifyHike({
        ...base,
        track: northTrack(lengthM, { secondsPerPoint: 0 }),
      });
      expect(result.reason).toBe('too_fast');
    });

    it('skips the speed check when the trail has no distance', () => {
      for (const trailDistanceKm of [null, undefined, 0, NaN]) {
        const result = verifyHike({
          ...base,
          trailDistanceKm,
          track: northTrack(lengthM, { secondsPerPoint: 0 }),
        });
        expect(result.reason).toBe('ok');
      }
    });

    it('reports low coverage before speed', () => {
      const result = verifyHike({
        ...base,
        track: northTrack(lengthM, { fraction: 0.2 }),
        elapsedSeconds: 1,
      });
      expect(result.reason).toBe('low_coverage');
    });
  });

  describe('missing data', () => {
    it.each([
      ['no track', undefined],
      ['a null track', null],
      ['an empty track', []],
      ['a single point', [[42.66, 44.6, T0]]],
      [
        'only invalid points',
        [
          [95, 44.6, T0],
          [42.66, 200, T0],
        ],
      ],
    ])('reports no_track for %s', (_label, track) => {
      expect(verifyHike({ ...base, track: track as never })).toEqual({
        verified: false,
        coverage: 0,
        reason: 'no_track',
      });
    });

    it.each([
      ['no route', null],
      ['an empty route', []],
      ['a single vertex', [[44.6, 42.66]]],
    ])('reports no_route for %s', (_label, value) => {
      expect(
        verifyHike({ ...base, route: value, track: northTrack(lengthM) }),
      ).toEqual({ verified: false, coverage: 0, reason: 'no_route' });
    });

    it('checks the track before the route', () => {
      expect(verifyHike({ ...base, route: null, track: [] }).reason).toBe(
        'no_track',
      );
    });

    it('ignores invalid route vertices', () => {
      const result = verifyHike({
        ...base,
        route: [[NaN, 42.66], ...route, [500, 500]],
        track: northTrack(lengthM),
      });
      expect(result).toEqual({ verified: true, coverage: 1, reason: 'ok' });
    });

    it('ignores the altitude of route vertices', () => {
      const withAltitude = route.map(([lng, lat]) => [lng, lat, 1800]);
      const result = verifyHike({
        ...base,
        route: withAltitude,
        track: northTrack(lengthM),
      });
      expect(result.reason).toBe('ok');
    });
  });

  it('rounds coverage to three decimals', () => {
    const result = verifyHike({
      route: northRoute(3, 1000),
      trailDistanceKm: 2,
      track: northTrack(100),
      thresholds: THRESHOLDS,
    });
    expect(result.coverage).toBe(0.333);
  });

  it('handles 800 route vertices against 5000 track points quickly', () => {
    // 40 km route with a vertex every 50 m, track point every 8 m
    const longRoute = northRoute(800, 50);
    const track = northTrack(40_000, { spacingM: 8, secondsPerPoint: 2 }).slice(
      0,
      5000,
    );
    expect(track).toHaveLength(5000);

    const started = performance.now();
    const result = verifyHike({
      route: longRoute,
      trailDistanceKm: 40,
      track,
      elapsedSeconds: 36_000,
      thresholds: THRESHOLDS,
    });
    const elapsedMs = performance.now() - started;

    expect(result).toEqual({ verified: true, coverage: 1, reason: 'ok' });
    expect(elapsedMs).toBeLessThan(250);
  });

  it('stays fast when every track point falls into the same cell', () => {
    const longRoute = northRoute(20_000, 5);
    const track = Array.from(
      { length: 5000 },
      (_, i): [number, number, number] => [START.lat, START.lng, T0 + i],
    );

    const started = performance.now();
    const result = verifyHike({
      route: longRoute,
      trailDistanceKm: 1,
      track,
      thresholds: THRESHOLDS,
    });

    expect(result.reason).toBe('low_coverage');
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
