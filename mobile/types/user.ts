import type { CompletionSource } from './completion';

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  contact_info: string | null;
  /** Plain Instagram username (no @); absent from older servers. */
  instagram_handle?: string | null;
  total_trails_completed: number;
  /** Trails completed with a recorded hike: what the leaderboard counts. Newer servers only. */
  ranked_trails_completed?: number;
  created_at: string;
  last_seen_at: string | null;
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
  source?: CompletionSource | null;
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
  /** On the leaderboard this is the ranked count: trails completed with a recorded hike. */
  total_trails_completed: number;
  /** The same ranked count under an explicit name, from newer servers. */
  ranked_trails_completed?: number;
  rank: number;
}

/** Response of `POST /users/me/sos`. `sent` is true only if a push reached the contact's device(s). */
export interface SosResult {
  sent: boolean;
  reason: 'ok' | 'no_contact' | 'contact_unreachable';
  devices: number;
}
