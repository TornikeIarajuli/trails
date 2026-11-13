import { Checkpoint } from './checkpoint';
import { GeoPoint, GeoLineString } from './geo';

export type { GeoPoint, GeoLineString } from './geo';

export type TrailDifficulty = 'easy' | 'medium' | 'hard' | 'ultra';
export type TrailStatus = 'open' | 'closed' | 'seasonal' | 'maintenance';
export type MediaType = 'photo' | 'video';

export interface Trail {
  id: string;
  name_en: string;
  name_ka: string | null;
  description_en: string | null;
  description_ka: string | null;
  difficulty: TrailDifficulty;
  region: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  estimated_hours: number | null;
  cover_image_url: string | null;
  is_published: boolean;
  status: TrailStatus;
  status_note: string | null;
  created_at: string;
  start_point?: GeoPoint | null;
  /** `[distance_m, elevation_m]` pairs sampled along the route (trail detail only); null when unmeasured. */
  elevation_profile?: [number, number][] | null;
}

export interface TrailMedia {
  id: string;
  trail_id: string;
  type: MediaType;
  url: string;
  caption: string | null;
  sort_order: number;
}

export interface TrailDetail extends Trail {
  media: TrailMedia[];
  checkpoints: Checkpoint[];
  avg_rating: number | null;
  review_count: number;
  start_point: GeoPoint | null;
  end_point: GeoPoint | null;
  route: GeoLineString | null;
  conditions_count: number;
  recent_conditions: {
    id: string;
    condition_type: string;
    severity: string;
    description: string | null;
    reported_at: string;
  }[];
  photos_count: number;
}

export interface NearbyTrail {
  id: string;
  name_en: string;
  name_ka: string | null;
  difficulty: TrailDifficulty;
  region: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  estimated_hours: number | null;
  cover_image_url: string | null;
  distance_from_user_m: number;
  // Returned once the nearby RPC has been upgraded (migration 046); absent before that.
  status?: TrailStatus | null;
  status_note?: string | null;
  start_point?: GeoPoint | null;
}

/** What a trail row or map pin needs — satisfied by list items and nearby results alike. */
export type TrailSummary = Pick<
  Trail,
  | 'id'
  | 'name_en'
  | 'name_ka'
  | 'difficulty'
  | 'region'
  | 'distance_km'
  | 'elevation_gain_m'
  | 'estimated_hours'
  | 'cover_image_url'
> & {
  status?: TrailStatus | null;
  status_note?: string | null;
  start_point?: GeoPoint | null;
};

// Re-export for convenience
export type { Checkpoint } from './checkpoint';
