/**
 * Topographic map tiles from OpenTopoMap: tile maths, and the plan of which tiles to save
 * for a trail. Pure functions; the files themselves are handled by services/offlineMaps.
 */

export const TOPO_TILE_URL = 'https://tile.opentopomap.org/{z}/{x}/{y}.png';
/** The highest zoom level OpenTopoMap serves; closer views scale these tiles up. */
export const TOPO_MAX_ZOOM = 17;
/** Required by OpenTopoMap's terms wherever its tiles are shown. */
export const TOPO_ATTRIBUTION =
  'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)';
export const TOPO_ATTRIBUTION_URL = 'https://opentopomap.org/about';
/** Sent with the tiles the app downloads itself, so the tile server can tell who is asking. */
export const TOPO_USER_AGENT = 'MikiriTrails (Android hiking app)';
/** Tiles kept from browsing are refreshed (in the background, still shown meanwhile) after this. */
export const TILE_CACHE_MAX_AGE_S = 30 * 24 * 60 * 60;

/** What a trail download covers: the route plus about a kilometre around it, zoom 10 to 15. */
export const TRAIL_DOWNLOAD = {
  padKm: 1,
  minZoom: 10,
  maxZoom: 15,
  /** Hard limit per trail, to keep downloads light on the free tile server. */
  maxTiles: 300,
} as const;

const MAX_LATITUDE = 85.0511287798;

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface LatLngBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface TileRange {
  z: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface TilePlan {
  /** Tile keys ("z/x/y"), lowest zoom first. */
  tiles: string[];
  minZoom: number;
  /** The highest zoom level that fitted under the cap; null when nothing fits. */
  maxZoom: number | null;
  /** Zoom levels left out to stay under the cap, highest first. */
  droppedZooms: number[];
}

export const tileKey = ({ z, x, y }: TileCoord) => `${z}/${x}/${y}`;

export function parseTileKey(key: string): TileCoord | null {
  const parts = key.split('/');
  if (parts.length !== 3) return null;
  const [z, x, y] = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  if (![z, x, y].every(Number.isInteger)) return null;
  const n = 2 ** z;
  if (x >= n || y >= n) return null;
  return { z, x, y };
}

export function tileUrl(tile: TileCoord): string {
  return TOPO_TILE_URL.replace('{z}', String(tile.z))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y));
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Column of the Web Mercator ("slippy map") tile containing this longitude. */
export function lngToTileX(lng: number, z: number): number {
  const n = 2 ** z;
  return clamp(Math.floor(((lng + 180) / 360) * n), 0, n - 1);
}

/** Row of the Web Mercator tile containing this latitude (row 0 is the north edge). */
export function latToTileY(lat: number, z: number): number {
  const n = 2 ** z;
  const rad = (clamp(lat, -MAX_LATITUDE, MAX_LATITUDE) * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return clamp(y, 0, n - 1);
}

/** Longitude of a tile column's west edge. */
export function tileXToLng(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

/** Latitude of a tile row's north edge. */
export function tileYToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

export function boundsOf(points: LatLng[]): LatLngBounds | null {
  let bounds: LatLngBounds | null = null;
  for (const { latitude, longitude } of points) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (!bounds) {
      bounds = { minLat: latitude, maxLat: latitude, minLng: longitude, maxLng: longitude };
      continue;
    }
    bounds.minLat = Math.min(bounds.minLat, latitude);
    bounds.maxLat = Math.max(bounds.maxLat, latitude);
    bounds.minLng = Math.min(bounds.minLng, longitude);
    bounds.maxLng = Math.max(bounds.maxLng, longitude);
  }
  return bounds;
}

/**
 * Widens the bounds by `km` on every side. Rounded up: degrees are converted with the shortest
 * kilometre-per-degree lengths, and longitude at the edge nearest a pole, where it is shortest.
 */
export function padBounds(bounds: LatLngBounds, km: number): LatLngBounds {
  const latPad = km / 110.574;
  const poleward = Math.min(89, Math.max(Math.abs(bounds.minLat), Math.abs(bounds.maxLat)) + latPad);
  const lngPad = km / (111.195 * Math.cos((poleward * Math.PI) / 180));
  return {
    minLat: bounds.minLat - latPad,
    maxLat: bounds.maxLat + latPad,
    minLng: bounds.minLng - lngPad,
    maxLng: bounds.maxLng + lngPad,
  };
}

export function tileRange(bounds: LatLngBounds, z: number): TileRange {
  return {
    z,
    xMin: lngToTileX(bounds.minLng, z),
    xMax: lngToTileX(bounds.maxLng, z),
    yMin: latToTileY(bounds.maxLat, z),
    yMax: latToTileY(bounds.minLat, z),
  };
}

export function rangeTileCount(range: TileRange): number {
  return (range.xMax - range.xMin + 1) * (range.yMax - range.yMin + 1);
}

function rangeTileKeys(range: TileRange): string[] {
  const keys: string[] = [];
  for (let x = range.xMin; x <= range.xMax; x++) {
    for (let y = range.yMin; y <= range.yMax; y++) keys.push(tileKey({ z: range.z, x, y }));
  }
  return keys;
}

/**
 * The tiles to save for a trail: its points' bounding box padded by `padKm`, at every zoom
 * from `minZoom` to `maxZoom`. Each level has about four times the tiles of the one below,
 * so when the total is over `maxTiles` the highest levels are dropped until it fits. The
 * plan never exceeds `maxTiles`; if even `minZoom` alone does not fit, it is empty.
 */
export function planTrailTiles(
  points: LatLng[],
  options: { padKm?: number; minZoom?: number; maxZoom?: number; maxTiles?: number } = {},
): TilePlan {
  const {
    padKm = TRAIL_DOWNLOAD.padKm,
    minZoom = TRAIL_DOWNLOAD.minZoom,
    maxZoom = TRAIL_DOWNLOAD.maxZoom,
    maxTiles = TRAIL_DOWNLOAD.maxTiles,
  } = options;
  const bounds = boundsOf(points);
  if (!bounds || maxZoom < minZoom) return { tiles: [], minZoom, maxZoom: null, droppedZooms: [] };

  const padded = padBounds(bounds, padKm);
  const ranges: TileRange[] = [];
  for (let z = minZoom; z <= maxZoom; z++) ranges.push(tileRange(padded, z));

  let total = ranges.reduce((sum, r) => sum + rangeTileCount(r), 0);
  const droppedZooms: number[] = [];
  while (ranges.length > 0 && total > maxTiles) {
    const dropped = ranges.pop()!;
    total -= rangeTileCount(dropped);
    droppedZooms.push(dropped.z);
  }

  return {
    tiles: ranges.flatMap(rangeTileKeys),
    minZoom,
    maxZoom: ranges.length > 0 ? ranges[ranges.length - 1].z : null,
    droppedZooms,
  };
}

/**
 * Typical OpenTopoMap tile sizes over Georgia's mountains (sampled): low zooms carry
 * more relief shading and labels per tile than close-ups.
 */
export function estimatedTileBytes(z: number): number {
  if (z <= 12) return 50_000;
  if (z === 13) return 46_000;
  if (z === 14) return 40_000;
  return 32_000;
}

export function estimatePlanBytes(plan: Pick<TilePlan, 'tiles'>): number {
  return plan.tiles.reduce((sum, key) => sum + estimatedTileBytes(parseTileKey(key)?.z ?? 15), 0);
}

/** "12 MB", "0.4 MB": sizes of saved maps, in megabytes as people read them. */
export function formatMegabytes(bytes: number): string {
  const mb = bytes / 1_000_000;
  if (mb <= 0) return '0 MB';
  if (mb < 1) return `${Math.max(0.1, Math.round(mb * 10) / 10)} MB`;
  return `${Math.round(mb)} MB`;
}

/** A `file://` URI as a plain filesystem path (UrlTile's cache path), without a trailing slash. */
export function fileUriToPath(uri: string): string {
  const path = uri.replace(/^file:\/\//, '');
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // Not percent-encoded after all
  }
  return decoded.length > 1 ? decoded.replace(/\/+$/, '') : decoded;
}
