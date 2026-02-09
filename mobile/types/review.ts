export interface Review {
  id: string;
  trail_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}
