export type CompletionStatus = 'pending' | 'approved' | 'rejected';

export interface TrailCompletion {
  id: string;
  user_id: string;
  trail_id: string;
  proof_photo_url: string | null;
  photo_lat: number | null;
  photo_lng: number | null;
  status: CompletionStatus;
  elapsed_seconds: number | null;
  reviewer_note: string | null;
  completed_at: string;
  created_at: string;
  trails?: {
    id: string;
    name_en: string;
    name_ka: string | null;
    difficulty: string;
    region: string;
    cover_image_url: string | null;
    distance_km: number | null;
    elevation_gain_m: number | null;
    estimated_hours: number | null;
  };
}

/** One recorded position as sent to the API: [lat, lng, unixSeconds]. */
export type TrackPoint = [lat: number, lng: number, unixSeconds: number];

/** Body of `POST /completions/record`. Everything but `trail_id` is optional. */
export interface RecordHikePayload {
  trail_id: string;
  elapsed_seconds?: number;
  started_at?: string;
  completed_at?: string;
  distance_m?: number;
  track?: TrackPoint[];
}

export type VerificationReason = 'ok' | 'no_track' | 'low_coverage' | 'too_fast' | 'no_route';

export interface HikeVerification {
  coverage: number;
  required_coverage: number;
  reason: VerificationReason;
}

/**
 * Response of `POST /completions/record`. Only `id` is relied on: a backend that
 * predates track verification returns neither `verified` nor `verification`.
 */
export interface RecordHikeResponse {
  id: string;
  user_id?: string;
  trail_id?: string;
  status?: CompletionStatus;
  completed_at?: string;
  elapsed_seconds?: number | null;
  verified?: boolean;
  verification?: HikeVerification;
  new_badge_ids?: string[];
  already_existed?: boolean;
}

/** A finished hike that could not be uploaded yet and is waiting on the phone. */
export interface PendingCompletion {
  localId: string;
  /** null only for an entry migrated from the old single-slot format, which did not record its owner. */
  userId: string | null;
  trailId: string;
  elapsedSeconds: number;
  startedAt: string | null;
  completedAt: string;
  distanceM: number | null;
  track: TrackPoint[];
  attempts: number;
}
