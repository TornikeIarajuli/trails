import { toLatLng } from '../../utils/mapPoint';

describe('toLatLng', () => {
  it('reads GeoJSON with a crs member (trail list/detail endpoints)', () => {
    const point = {
      type: 'Point',
      crs: { type: 'name', properties: { name: 'EPSG:4326' } },
      coordinates: [44.8350335, 42.5492528],
    };
    expect(toLatLng(point)).toEqual({ latitude: 42.5492528, longitude: 44.8350335 });
  });

  it('reads plain GeoJSON (nearby endpoint)', () => {
    expect(toLatLng({ type: 'Point', coordinates: [42.7255683, 43.0442666] })).toEqual({
      latitude: 43.0442666,
      longitude: 42.7255683,
    });
  });

  it('returns null for missing or malformed points', () => {
    expect(toLatLng(null)).toBeNull();
    expect(toLatLng(undefined)).toBeNull();
    expect(toLatLng({})).toBeNull();
    expect(toLatLng({ coordinates: [44.8] })).toBeNull();
    expect(toLatLng({ coordinates: ['44.8', '42.5'] })).toBeNull();
    expect(toLatLng({ coordinates: [NaN, 42.5] })).toBeNull();
  });

  it('rejects coordinates outside the valid range', () => {
    expect(toLatLng({ coordinates: [44.8, 95] })).toBeNull();
    expect(toLatLng({ coordinates: [200, 42.5] })).toBeNull();
  });
});
