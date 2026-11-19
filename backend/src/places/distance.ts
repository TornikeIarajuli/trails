/**
 * Distances between places and the boxes that prefilter a radius search. Pure: no I/O.
 */

const EARTH_RADIUS_KM = 6371.0088;

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;

/** Kilometres between two points (haversine). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

export interface Box {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** The smallest latitude/longitude box holding every point within radiusKm of a point. */
export function boundingBox(lat: number, lng: number, radiusKm: number): Box {
  const angle = radiusKm / EARTH_RADIUS_KM;
  const dLat = deg(angle);
  // the circle is widest a little poleward of its centre, hence asin rather than a plain division
  const dLng = deg(
    Math.asin(Math.min(1, Math.sin(angle) / Math.cos(rad(lat)))),
  );
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}

/** Kilometres to one decimal. */
export const roundKm = (km: number) => Math.round(km * 10) / 10;
