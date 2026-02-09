export type ActivityType = 'completion' | 'photo' | 'condition' | 'review';

export interface FeedItem {
  activity_id: string;
  activity_type: ActivityType;
  user_id: string;
  trail_id: string;
  created_at: string;
  extra_text: string | null;
  photo_url: string | null;
  user_username: string;
  user_full_name: string | null;
  user_avatar_url: string | null;
  trail_name_en: string;
  trail_name_ka: string | null;
  trail_cover_image_url: string | null;
}
