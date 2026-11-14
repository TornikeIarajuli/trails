import {
  TOPO_ATTRIBUTION,
  TRAIL_DOWNLOAD,
  boundsOf,
  estimatePlanBytes,
  estimatedTileBytes,
  fileUriToPath,
  formatMegabytes,
  latToTileY,
  lngToTileX,
  padBounds,
  parseTileKey,
  planTrailTiles,
  rangeTileCount,
  tileKey,
  tileRange,
  tileUrl,
  tileXToLng,
  tileYToLat,
} from '../../utils/topoTiles';
import { haversineDistance } from '../../utils/geo';

const KAZBEGI = { latitude: 42.6617, longitude: 44.6406 };

describe('lat/lng to tile x/y', () => {
  it('puts the whole world in one tile at zoom 0', () => {
    expect([lngToTileX(44.6, 0), latToTileY(42.6, 0)]).toEqual([0, 0]);
    expect([lngToTileX(-120, 0), latToTileY(-33, 0)]).toEqual([0, 0]);
  });

  it('splits the world into quadrants at zoom 1, row 0 in the north', () => {
    expect([lngToTileX(0, 1), latToTileY(0, 1)]).toEqual([1, 1]);
    expect([lngToTileX(-90, 1), latToTileY(45, 1)]).toEqual([0, 0]);
    expect([lngToTileX(90, 1), latToTileY(-45, 1)]).toEqual([1, 1]);
  });

  it('finds the tiles of a known place', () => {
    // Stepantsminda (Kazbegi)
    expect([lngToTileX(KAZBEGI.longitude, 10), latToTileY(KAZBEGI.latitude, 10)]).toEqual([638, 377]);
    expect([lngToTileX(KAZBEGI.longitude, 12), latToTileY(KAZBEGI.latitude, 12)]).toEqual([2555, 1510]);
    expect([lngToTileX(KAZBEGI.longitude, 15), latToTileY(KAZBEGI.latitude, 15)]).toEqual([20447, 12082]);
  });

  it('gives tiles whose edges contain the point', () => {
    const places = [KAZBEGI, { latitude: 41.7151, longitude: 44.8271 }, { latitude: 43.0446, longitude: 42.7276 }];
    for (const { latitude, longitude } of places) {
      for (const z of [8, 10, 13, 15, 17]) {
        const x = lngToTileX(longitude, z);
        const y = latToTileY(latitude, z);
        expect(tileXToLng(x, z)).toBeLessThanOrEqual(longitude);
        expect(tileXToLng(x + 1, z)).toBeGreaterThan(longitude);
        expect(tileYToLat(y, z)).toBeGreaterThanOrEqual(latitude);
        expect(tileYToLat(y + 1, z)).toBeLessThan(latitude);
      }
    }
  });

  it('stays on the map at the edges of the world', () => {
    expect(lngToTileX(180, 4)).toBe(15);
    expect(lngToTileX(-180, 4)).toBe(0);
    expect(latToTileY(89.9, 4)).toBe(0);
    expect(latToTileY(-89.9, 4)).toBe(15);
  });
});

describe('tile keys and URLs', () => {
  it('round-trips keys and builds the OpenTopoMap URL', () => {
    expect(tileKey({ z: 13, x: 5068, y: 3008 })).toBe('13/5068/3008');
    expect(parseTileKey('13/5068/3008')).toEqual({ z: 13, x: 5068, y: 3008 });
    expect(tileUrl({ z: 13, x: 5068, y: 3008 })).toBe('https://tile.opentopomap.org/13/5068/3008.png');
  });

  it('rejects malformed keys and tiles off the map', () => {
    expect(parseTileKey('13/5068')).toBeNull();
    expect(parseTileKey('a/b/c')).toBeNull();
    expect(parseTileKey('2/4/0')).toBeNull();
    expect(parseTileKey('13/-1/3008')).toBeNull();
  });

  it('credits OpenStreetMap, SRTM and OpenTopoMap', () => {
    expect(TOPO_ATTRIBUTION).toBe(
      'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)',
    );
  });
});

describe('bounding box to tiles', () => {
  it('bounds a route, skipping broken points', () => {
    expect(
      boundsOf([
        { latitude: 42.6, longitude: 44.6 },
        { latitude: NaN, longitude: 44.9 },
        { latitude: 42.7, longitude: 44.5 },
      ]),
    ).toEqual({ minLat: 42.6, maxLat: 42.7, minLng: 44.5, maxLng: 44.6 });
    expect(boundsOf([])).toBeNull();
  });

  it('pads by at least the distance asked for, on every side', () => {
    const b = { minLat: 42.6, maxLat: 42.7, minLng: 44.5, maxLng: 44.6 };
    const p = padBounds(b, 1);
    expect(haversineDistance(b.maxLat, 44.55, p.maxLat, 44.55)).toBeGreaterThanOrEqual(999);
    expect(haversineDistance(b.minLat, 44.55, p.minLat, 44.55)).toBeGreaterThanOrEqual(999);
    expect(haversineDistance(p.maxLat, b.minLng, p.maxLat, p.minLng)).toBeGreaterThanOrEqual(999);
    expect(haversineDistance(p.maxLat, b.maxLng, p.maxLat, p.maxLng)).toBeGreaterThanOrEqual(999);
    // ...and not much more
    expect(haversineDistance(b.maxLat, 44.55, p.maxLat, 44.55)).toBeLessThan(1010);
  });

  it('counts the tiles a box covers', () => {
    // From inside tile 2555/1510 to inside tile 2556/1511 at zoom 12: a 2 x 2 block
    const z = 12;
    const inside = (x: number, y: number) => ({
      lng: (tileXToLng(x, z) + tileXToLng(x + 1, z)) / 2,
      lat: (tileYToLat(y, z) + tileYToLat(y + 1, z)) / 2,
    });
    const nw = inside(2555, 1510);
    const se = inside(2556, 1511);
    const range = tileRange({ minLat: se.lat, maxLat: nw.lat, minLng: nw.lng, maxLng: se.lng }, z);
    expect(range).toEqual({ z, xMin: 2555, xMax: 2556, yMin: 1510, yMax: 1511 });
    expect(rangeTileCount(range)).toBe(4);
  });

  it('covers a single point with one tile per level', () => {
    const range = tileRange({ minLat: 42.66, maxLat: 42.66, minLng: 44.64, maxLng: 44.64 }, 14);
    expect(rangeTileCount(range)).toBe(1);
  });
});

describe('planTrailTiles', () => {
  // About 3 km of path near Stepantsminda
  const shortRoute = [
    { latitude: 42.6617, longitude: 44.6406 },
    { latitude: 42.6655, longitude: 44.6201 },
    { latitude: 42.6672, longitude: 44.6045 },
  ];
  // A multi-day trek's extent (Mestia to Ushguli)
  const longRoute = [
    { latitude: 43.0446, longitude: 42.7276 },
    { latitude: 42.98, longitude: 42.86 },
    { latitude: 42.9167, longitude: 43.0142 },
  ];

  it('covers zoom 10 to 15 for a short trail, lowest zoom first', () => {
    const plan = planTrailTiles(shortRoute);
    expect(plan.minZoom).toBe(10);
    expect(plan.maxZoom).toBe(15);
    expect(plan.droppedZooms).toEqual([]);
    const zooms = plan.tiles.map((k) => parseTileKey(k)!.z);
    expect(new Set(zooms)).toEqual(new Set([10, 11, 12, 13, 14, 15]));
    expect(zooms).toEqual([...zooms].sort((a, b) => a - b));
    expect(new Set(plan.tiles).size).toBe(plan.tiles.length);
    expect(plan.tiles.length).toBeLessThanOrEqual(TRAIL_DOWNLOAD.maxTiles);
  });

  it('includes the tiles around the route, about a kilometre out', () => {
    const plan = planTrailTiles(shortRoute);
    const padded = padBounds(boundsOf(shortRoute)!, 1);
    for (const corner of [
      [padded.maxLat, padded.minLng],
      [padded.minLat, padded.maxLng],
    ]) {
      const key = tileKey({ z: 15, x: lngToTileX(corner[1], 15), y: latToTileY(corner[0], 15) });
      expect(plan.tiles).toContain(key);
    }
  });

  it('drops the highest zoom levels of a long trail to stay within 300 tiles', () => {
    const plan = planTrailTiles(longRoute);
    expect(plan.tiles.length).toBeLessThanOrEqual(300);
    expect(plan.droppedZooms[0]).toBe(15);
    expect(plan.maxZoom).not.toBeNull();
    expect(plan.maxZoom!).toBeLessThan(15);
    expect(plan.droppedZooms).toEqual(
      Array.from({ length: 15 - plan.maxZoom! }, (_, i) => 15 - i),
    );
    // The levels kept are complete: zoom 10 up to the highest one kept
    const zooms = new Set(plan.tiles.map((k) => parseTileKey(k)!.z));
    for (let z = 10; z <= plan.maxZoom!; z++) expect(zooms.has(z)).toBe(true);
  });

  it('keeps as many levels as fit: one more would go over the cap', () => {
    const plan = planTrailTiles(longRoute);
    const next = tileRange(padBounds(boundsOf(longRoute)!, 1), plan.maxZoom! + 1);
    expect(plan.tiles.length + rangeTileCount(next)).toBeGreaterThan(300);
  });

  it('never goes over the cap, whatever the size of the area', () => {
    for (const spanDeg of [0.001, 0.02, 0.05, 0.1, 0.2, 0.4, 0.8, 1.6]) {
      const route = [KAZBEGI, { latitude: KAZBEGI.latitude + spanDeg, longitude: KAZBEGI.longitude + spanDeg }];
      expect(planTrailTiles(route).tiles.length).toBeLessThanOrEqual(300);
    }
  });

  it('plans nothing when even the lowest zoom does not fit', () => {
    const plan = planTrailTiles(shortRoute, { maxTiles: 0 });
    expect(plan).toEqual({ tiles: [], minZoom: 10, maxZoom: null, droppedZooms: [15, 14, 13, 12, 11, 10] });
  });

  it('plans nothing without points', () => {
    expect(planTrailTiles([]).tiles).toEqual([]);
    expect(planTrailTiles([]).maxZoom).toBeNull();
  });
});

describe('download size', () => {
  it('estimates from typical tile sizes per zoom', () => {
    expect(estimatedTileBytes(10)).toBe(50_000);
    expect(estimatedTileBytes(15)).toBe(32_000);
    expect(estimatePlanBytes({ tiles: ['10/638/377', '15/20447/12082', '15/20447/12083'] })).toBe(114_000);
  });

  it('shows megabytes as people read them', () => {
    expect(formatMegabytes(11_600_000)).toBe('12 MB');
    expect(formatMegabytes(400_000)).toBe('0.4 MB');
    expect(formatMegabytes(20_000)).toBe('0.1 MB');
    expect(formatMegabytes(0)).toBe('0 MB');
  });
});

describe('fileUriToPath', () => {
  it('turns a file URI into the plain path UrlTile caches into', () => {
    expect(fileUriToPath('file:///data/user/0/com.app/files/tiles/opentopomap/')).toBe(
      '/data/user/0/com.app/files/tiles/opentopomap',
    );
    expect(fileUriToPath('file:///var/mobile/My%20App/Documents/tiles/')).toBe('/var/mobile/My App/Documents/tiles');
    expect(fileUriToPath('/already/a/path')).toBe('/already/a/path');
  });
});
