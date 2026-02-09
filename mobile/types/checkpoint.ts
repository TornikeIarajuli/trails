export type CheckpointType =
  | 'viewpoint'
  | 'water_source'
  | 'campsite'
  | 'landmark'
  | 'summit'
  | 'shelter'
  | 'bridge'
  | 'pass'
  | 'lake'
  | 'waterfall'
  | 'ruins'
  | 'church'
  | 'tower';

export interface Checkpoint {
  id: string;
  trail_id: string;
  name_en: string;
  name_ka: string | null;
  description_en: string | null;
  description_ka: string | null;
  type: CheckpointType;
  coordinates: unknown;
  elevation_m: number | null;
  photo_url: string | null;
  sort_order: number;
  is_checkable: boolean;
}

export interface CheckpointCompletion {
  id: string;
  user_id: string;
  checkpoint_id: string;
  proof_photo_url: string;
  photo_lat: number;
  photo_lng: number;
  completed_at: string;
  created_at: string;
  trail_checkpoints?: Checkpoint;
}
