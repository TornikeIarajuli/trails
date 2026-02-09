// Haversine formula: calculate distance in meters between two lat/lng coordinates
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function formatDistanceMeters(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// Parse PostGIS GeoJSON Point → { latitude, longitude }
export function parseGeoPoint(
  geo: any,
): { latitude: number; longitude: number } | null {
  if (!geo?.coordinates || geo.coordinates.length < 2) return null;
  // PostGIS returns [lng, lat]
  return { latitude: geo.coordinates[1], longitude: geo.coordinates[0] };
}

// Parse PostGIS GeoJSON LineString → array of { latitude, longitude }
export function parseGeoLineString(
  geo: any,
): { latitude: number; longitude: number }[] {
  if (!geo?.coordinates || !Array.isArray(geo.coordinates)) return [];
  return geo.coordinates.map((c: number[]) => ({
    latitude: c[1],
    longitude: c[0],
  }));
}
