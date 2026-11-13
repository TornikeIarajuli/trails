export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Converts a GeoJSON Point from the API into a map coordinate.
 *
 * Trail list/detail endpoints return geometry with a `crs` member, the nearby
 * endpoint returns plain GeoJSON — only `coordinates` ([longitude, latitude]) is
 * read, so both work. Anything that is not a real position yields null, because
 * handing NaN or out-of-range coordinates to the native map can crash it.
 */
export function toLatLng(point: unknown): LatLng | null {
  const coordinates = (point as { coordinates?: unknown } | null | undefined)?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const [longitude, latitude] = coordinates;
  if (typeof longitude !== 'number' || typeof latitude !== 'number') return null;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return { latitude, longitude };
}
