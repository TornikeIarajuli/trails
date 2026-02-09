export type BadgeCategory = 'completions' | 'difficulty' | 'region' | 'streak' | 'special';

export interface Badge {
  id: string;
  key: string;
  name_en: string;
  name_ka: string | null;
  description_en: string;
  description_ka: string | null;
  icon: string;
  category: BadgeCategory;
  threshold: number | null;
  region: string | null;
  difficulty: string | null;
  sort_order: number;
}

export interface UserBadge {
  id: string;
  badge_id: string;
  earned_at: string;
  badges: Badge;
}
