/**
 * XP and levels. The server counts XP (migration 065); the levels and the rules shown to
 * hikers live here. Keep XP_RULES in step with the migration.
 */

export interface Level {
  level: number;
  name: string;
  minXp: number;
}

export const LEVELS: Level[] = [
  { level: 1, name: 'Newcomer', minXp: 0 },
  { level: 2, name: 'Walker', minXp: 100 },
  { level: 3, name: 'Hiker', minXp: 300 },
  { level: 4, name: 'Trekker', minXp: 700 },
  { level: 5, name: 'Ridge walker', minXp: 1500 },
  { level: 6, name: 'Pass crosser', minXp: 3000 },
  { level: 7, name: 'Peak bagger', minXp: 5000 },
  { level: 8, name: 'Mountaineer', minXp: 8000 },
  { level: 9, name: 'Glacier walker', minXp: 12000 },
  { level: 10, name: 'Trail legend', minXp: 18000 },
];

export interface LevelProgress {
  current: Level;
  next: Level | null;
  /** 0 to 1 of the way to the next level; 1 at the top level. */
  progress: number;
  /** XP still needed for the next level; null at the top. */
  toNext: number | null;
}

export function levelFor(xp: number): LevelProgress {
  const points = Math.max(0, Math.floor(xp || 0));
  let index = 0;
  while (index + 1 < LEVELS.length && points >= LEVELS[index + 1].minXp) index++;
  const current = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;
  if (!next) return { current, next: null, progress: 1, toNext: null };
  return {
    current,
    next,
    progress: (points - current.minXp) / (next.minXp - current.minXp),
    toNext: next.minXp - points,
  };
}

/** What a hike recorded in the app earns: 100, plus 10 per km and 1 per 10 m climbed. */
export function hikeXp(distanceKm: number | null | undefined, elevationGainM: number | null | undefined): number {
  return 100 + Math.round((distanceKm ?? 0) * 10) + Math.floor((elevationGainM ?? 0) / 10);
}

/** "1,240 XP" */
export function formatXp(xp: number): string {
  return `${Math.round(xp).toLocaleString('en-US')} XP`;
}

/** How XP is earned, as shown in "How XP works". */
export const XP_RULES: { label: string; xp: string; note?: string }[] = [
  { label: 'Hike recorded in the app', xp: '100 + 10 per km + 1 per 10 m climbed', note: 'Once per trail per day' },
  { label: 'Trail marked as done', xp: '20', note: 'Hiked before the app' },
  { label: 'Photo', xp: '5', note: 'Up to 10 per trail' },
  { label: 'Review', xp: '20' },
  { label: 'Condition report', xp: '15', note: 'Once per trail per day' },
  { label: 'Post', xp: '10', note: 'Up to 3 a day' },
  { label: 'Badge', xp: '50' },
  { label: 'Group hike organised', xp: '30' },
];
