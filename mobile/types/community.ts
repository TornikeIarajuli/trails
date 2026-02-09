export type ConditionType =
  | 'trail_clear'
  | 'muddy'
  | 'snow'
  | 'fallen_tree'
  | 'flooded'
  | 'overgrown'
  | 'damaged'
  | 'closed';

export type SeverityLevel = 'info' | 'warning' | 'danger';

export interface TrailCondition {
  id: string;
  trail_id: string;
  user_id: string;
  condition_type: ConditionType;
  severity: SeverityLevel;
  description: string | null;
  photo_url: string | null;
  reported_at: string;
  is_active: boolean;
  profiles?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export interface TrailPhoto {
  id: string;
  trail_id: string;
  user_id: string;
  url: string;
  caption: string | null;
  taken_at: string;
  likes_count: number;
  is_liked?: boolean;
  profiles?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}
