/** PostGIS GeoJSON Point geometry (e.g. start_point, end_point) */
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

/** PostGIS GeoJSON LineString geometry (e.g. route) */
export interface GeoLineString {
  type: 'LineString';
  coordinates: [number, number][]; // Array of [longitude, latitude]
}
