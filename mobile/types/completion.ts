export type CompletionStatus = 'pending' | 'approved' | 'rejected';

export interface TrailCompletion {
  id: string;
  user_id: string;
  trail_id: string;
  proof_photo_url: string;
  photo_lat: number;
  photo_lng: number;
  status: CompletionStatus;
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
  };
}
