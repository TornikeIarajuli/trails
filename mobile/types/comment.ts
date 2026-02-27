export interface ActivityComment {
  id: string;
  activity_id: string;
  activity_type: string;
  user_id: string;
  comment: string;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
}
