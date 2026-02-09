export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  total_trails_completed: number;
  created_at: string;
}

export interface ProfileStats {
  easy: number;
  medium: number;
  hard: number;
  ultra: number;
  total: number;
}

export interface UserProfile extends Profile {
  stats: ProfileStats;
}

export interface TrailCompletion {
  id: string;
  completed_at: string;
  proof_photo_url: string | null;
  trails: {
    id: string;
    name_en: string;
    difficulty: string;
    region: string;
    cover_image_url: string | null;
    distance_km: number | null;
    elevation_gain_m: number | null;
  };
}

export interface PublicProfile extends Profile {
  stats: ProfileStats;
  completions: TrailCompletion[];
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  avatar_url: string | null;
  total_trails_completed: number;
  rank: number;
}
