import {
  haversineDistance,
  formatDistanceMeters,
  parseGeoPoint,
  parseGeoLineString,
} from '../../utils/geo';
import { GeoPoint, GeoLineString } from '../../types/geo';

// ---------------------------------------------------------------------------
// haversineDistance
// ---------------------------------------------------------------------------
describe('haversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistance(41.6, 44.8, 41.6, 44.8)).toBe(0);
  });

  it('computes a reasonable distance between two close Georgian cities', () => {
    // Tbilisi → Mtskheta — haversine gives ~18.9 km
    const dist = haversineDistance(41.6941, 44.8337, 41.8422, 44.7224);
    expect(dist).toBeGreaterThan(17_000);
    expect(dist).toBeLessThan(22_000);
  });

  it('is symmetric — distance A→B equals B→A', () => {
    const ab = haversineDistance(41.6, 44.8, 42.0, 45.0);
    const ba = haversineDistance(42.0, 45.0, 41.6, 44.8);
    expect(ab).toBeCloseTo(ba, 5);
  });

  it('approximates 111 km per degree of latitude at the equator', () => {
    // 1° latitude ≈ 111 km
    const dist = haversineDistance(0, 0, 1, 0);
    expect(dist).toBeGreaterThan(110_000);
    expect(dist).toBeLessThan(112_000);
  });

  it('handles negative (southern-hemisphere) coordinates', () => {
    // Sydney → Melbourne ≈ 714 km straight-line
    const dist = haversineDistance(-33.8688, 151.2093, -37.8136, 144.9631);
    expect(dist).toBeGreaterThan(700_000);
    expect(dist).toBeLessThan(730_000);
  });

  it('returns a positive value regardless of argument order', () => {
    expect(haversineDistance(42.0, 45.0, 41.0, 44.0)).toBeGreaterThan(0);
    expect(haversineDistance(41.0, 44.0, 42.0, 45.0)).toBeGreaterThan(0);
  });

  it('handles crossing the prime meridian (0° longitude)', () => {
    // London → Paris ≈ 340 km
    const dist = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    expect(dist).toBeGreaterThan(330_000);
    expect(dist).toBeLessThan(360_000);
  });
});

// ---------------------------------------------------------------------------
// formatDistanceMeters
// ---------------------------------------------------------------------------
describe('formatDistanceMeters', () => {
  it('formats 0 m correctly', () => {
    expect(formatDistanceMeters(0)).toBe('0m');
  });

  it('formats values below 1000 as whole metres with "m" suffix', () => {
    expect(formatDistanceMeters(500)).toBe('500m');
    expect(formatDistanceMeters(999)).toBe('999m');
    expect(formatDistanceMeters(1)).toBe('1m');
  });

  it('rounds fractional metres to the nearest integer', () => {
    expect(formatDistanceMeters(42.4)).toBe('42m');
    expect(formatDistanceMeters(42.6)).toBe('43m');
  });

  it('formats exactly 1000 m as "1.0km"', () => {
    expect(formatDistanceMeters(1000)).toBe('1.0km');
  });

  it('formats kilometres with one decimal place', () => {
    expect(formatDistanceMeters(1500)).toBe('1.5km');
    expect(formatDistanceMeters(5432)).toBe('5.4km');
    expect(formatDistanceMeters(12_300)).toBe('12.3km');
    expect(formatDistanceMeters(100_000)).toBe('100.0km');
  });

  it('does not use "km" suffix below 1000 m', () => {
    expect(formatDistanceMeters(800)).not.toContain('km');
  });

  it('always uses "km" suffix at or above 1000 m', () => {
    expect(formatDistanceMeters(1000)).toContain('km');
    expect(formatDistanceMeters(50_000)).toContain('km');
  });
});

// ---------------------------------------------------------------------------
// parseGeoPoint
// ---------------------------------------------------------------------------
describe('parseGeoPoint', () => {
  it('parses a valid PostGIS GeoJSON Point — note [lng, lat] coordinate order', () => {
    const geo: GeoPoint = { type: 'Point', coordinates: [44.8337, 41.6941] };
    expect(parseGeoPoint(geo)).toEqual({ latitude: 41.6941, longitude: 44.8337 });
  });

  it('correctly swaps PostGIS [lng, lat] to {latitude, longitude}', () => {
    const geo: GeoPoint = { type: 'Point', coordinates: [10.0, 20.0] }; // lng=10, lat=20
    const result = parseGeoPoint(geo);
    expect(result?.latitude).toBe(20.0);
    expect(result?.longitude).toBe(10.0);
  });

  it('returns null when the coordinates property is absent', () => {
    expect(parseGeoPoint({ type: 'Point' } as any)).toBeNull();
    expect(parseGeoPoint({} as any)).toBeNull();
  });

  it('returns null when the coordinates array has fewer than 2 elements', () => {
    expect(parseGeoPoint({ coordinates: [] } as any)).toBeNull();
    expect(parseGeoPoint({ coordinates: [44.8] } as any)).toBeNull();
  });

  it('returns null for null input', () => {
    expect(parseGeoPoint(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseGeoPoint(undefined)).toBeNull();
  });

  it('accepts a 3-element coordinate array (lng, lat, elevation)', () => {
    const geo = { type: 'Point', coordinates: [44.8, 41.6, 500] } as any;
    expect(parseGeoPoint(geo)).toEqual({ latitude: 41.6, longitude: 44.8 });
  });
});

// ---------------------------------------------------------------------------
// parseGeoLineString
// ---------------------------------------------------------------------------
describe('parseGeoLineString', () => {
  it('parses a valid PostGIS GeoJSON LineString', () => {
    const geo: GeoLineString = {
      type: 'LineString',
      coordinates: [
        [44.8337, 41.6941],
        [44.8400, 41.7000],
        [44.8460, 41.7060],
      ],
    };
    const result = parseGeoLineString(geo);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ latitude: 41.6941, longitude: 44.8337 });
    expect(result[1]).toEqual({ latitude: 41.7000, longitude: 44.8400 });
    expect(result[2]).toEqual({ latitude: 41.7060, longitude: 44.8460 });
  });

  it('returns an empty array for an empty coordinates list', () => {
    expect(parseGeoLineString({ coordinates: [] } as any)).toEqual([]);
  });

  it('returns an empty array when coordinates is not an array', () => {
    expect(parseGeoLineString({ coordinates: 'bad-data' } as any)).toEqual([]);
  });

  it('returns an empty array when the coordinates key is missing', () => {
    expect(parseGeoLineString({ type: 'LineString' } as any)).toEqual([]);
    expect(parseGeoLineString({} as any)).toEqual([]);
  });

  it('returns an empty array for null or undefined input', () => {
    expect(parseGeoLineString(null)).toEqual([]);
    expect(parseGeoLineString(undefined)).toEqual([]);
  });

  it('maps each coordinate pair maintaining the correct lat/lng swap', () => {
    const geo: GeoLineString = { type: 'LineString', coordinates: [[10.0, 20.0], [30.0, 40.0]] };
    const result = parseGeoLineString(geo);
    expect(result[0]).toEqual({ latitude: 20.0, longitude: 10.0 });
    expect(result[1]).toEqual({ latitude: 40.0, longitude: 30.0 });
  });

  it('handles a single-point LineString', () => {
    const geo: GeoLineString = { type: 'LineString', coordinates: [[44.8, 41.6]] };
    const result = parseGeoLineString(geo);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ latitude: 41.6, longitude: 44.8 });
  });
});
