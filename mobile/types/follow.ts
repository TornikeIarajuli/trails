export interface FollowUser {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface FollowCounts {
  followers_count: number;
  following_count: number;
}
