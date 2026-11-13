/** One region of Georgia and how much of it a user has hiked. */
export interface RegionProgress {
  region: string;
  total: number;
  completed: number;
  /** [longitude, latitude] of the region's trails, for the map; null when unknown. */
  center: [number, number] | null;
  completed_trail_ids: string[];
}

export interface RegionTotals {
  regions_total: number;
  regions_started: number;
  regions_completed: number;
  trails_total: number;
  trails_completed: number;
}

/** `GET /users/me/regions` and `GET /users/:id/regions`. */
export interface RegionProgressResponse {
  regions: RegionProgress[];
  totals: RegionTotals;
}
