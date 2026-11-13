// EWKT builders — PostgREST and Postgres both accept these strings for geometry columns.

function num(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Invalid coordinate: ${v}`);
  // 7 decimals is ~1 cm; avoids exponent notation and float noise
  return String(Math.round(v * 1e7) / 1e7);
}

function pair(c) {
  if (!Array.isArray(c) || c.length < 2) throw new Error(`Invalid coordinate pair: ${JSON.stringify(c)}`);
  const [lng, lat] = c;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) throw new Error(`Coordinate out of range: ${lng}, ${lat}`);
  return `${num(lng)} ${num(lat)}`;
}

export function pointEwkt(c) {
  return `SRID=4326;POINT(${pair(c)})`;
}

export function lineEwkt(coords) {
  if (!Array.isArray(coords) || coords.length < 2) throw new Error('A LineString needs at least 2 points');
  return `SRID=4326;LINESTRING(${coords.map(pair).join(',')})`;
}

/** Coordinates of a GeoJSON geometry as returned by PostgREST (may carry a `crs` member). */
export function geoJsonCoords(g) {
  if (!g) return null;
  if (typeof g === 'string') {
    try {
      return JSON.parse(g).coordinates ?? null;
    } catch {
      return null;
    }
  }
  return g.coordinates ?? null;
}

export const roundCoord = (c) => [Math.round(c[0] * 1e7) / 1e7, Math.round(c[1] * 1e7) / 1e7];
