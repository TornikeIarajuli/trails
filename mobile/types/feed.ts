export type ActivityType = 'completion' | 'photo' | 'condition' | 'review';

export interface FeedItem {
  activity_id: string;
  activity_type: ActivityType;
  user_id: string;
  trail_id: string;
  created_at: string;
  extra_text: string | null;
  photo_url: string | null;
  photo_urls: string[] | null;
  user_username: string;
  user_full_name: string | null;
  user_avatar_url: string | null;
  trail_name_en: string;
  trail_name_ka: string | null;
  trail_cover_image_url: string | null;
  // Sent by current API versions; undefined when talking to an older backend.
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
  /** The trail's distance and ascent, shown under completions. */
  trail_distance_km?: number | null;
  trail_elevation_gain_m?: number | null;
  /** How long the hike took; only completions have it, and not all of them. */
  elapsed_seconds?: number | null;
  /** The newest comment, by someone the viewer has not blocked; shown under the post. */
  latest_comment?: FeedComment | null;
  // Not sent by the API yet; shown when a future version adds it.
  /** 'past' for a trail marked as done before the app. */
  source?: 'hike' | 'past' | null;
}

export interface FeedComment {
  id?: string;
  user_id?: string;
  username: string;
  comment: string;
}
