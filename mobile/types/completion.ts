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
