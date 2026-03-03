export interface FollowUser {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

// Shape returned by the API: Supabase join with profiles nested
export interface FollowRow {
  id: string;
  profiles: FollowUser;
}

export interface FollowCounts {
  followers_count: number;
  following_count: number;
}
