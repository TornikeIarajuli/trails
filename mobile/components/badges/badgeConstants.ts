import { Badge, BadgeCategory } from '../../types/badge';

export const BADGE_ICON_MAP: Record<string, string> = {
  footsteps: 'footsteps',
  compass: 'compass',
  flame: 'flame',
  trophy: 'trophy',
  leaf: 'leaf',
  flag: 'flag',
  rocket: 'rocket',
  snow: 'snow',
  'trail-sign': 'trail-sign',
  wine: 'wine',
  camera: 'camera',
  megaphone: 'megaphone',
  bookmark: 'bookmark',
  star: 'star',
  ribbon: 'ribbon',
};

export const BADGE_CATEGORY_COLOR: Record<BadgeCategory, string> = {
  completions: '#F59E0B',
  difficulty:  '#EF4444',
  region:      '#3B82F6',
  streak:      '#8B5CF6',
  special:     '#10B981',
};

export const BADGE_CATEGORY_LABEL: Record<BadgeCategory, string> = {
  completions: 'Trail Completions',
  difficulty:  'Difficulty Challenge',
  region:      'Regional Explorer',
  streak:      'Streak',
  special:     'Special Achievement',
};

export type BadgeProgress = { current: number; target: number };

export type ProgressData = {
  total_completions: number;
  completions_by_difficulty: Record<string, number>;
  completions_by_region: Record<string, number>;
  unique_regions: number;
};

export function getBadgeProgress(badge: Badge, progress: ProgressData | undefined): BadgeProgress | null {
  if (!progress || !badge.threshold) return null;
  const target = badge.threshold;
  if (badge.category === 'completions') {
    return { current: Math.min(progress.total_completions, target), target };
  }
  if (badge.category === 'difficulty' && badge.difficulty) {
    const count = progress.completions_by_difficulty[badge.difficulty] ?? 0;
    return { current: Math.min(count, target), target };
  }
  if (badge.category === 'region' && badge.region) {
    const count = progress.completions_by_region[badge.region] ?? 0;
    return { current: Math.min(count, target), target };
  }
  return null;
}
