/** The leaderboard periods: this week (from Monday), this month, or all time. */
export const XP_PERIODS = ['week', 'month', 'all'] as const;
export type XpPeriod = (typeof XP_PERIODS)[number];

/** Georgia is UTC+4 all year (no daylight saving time). */
const TBILISI_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When this week (Monday 00:00) and this month (the 1st, 00:00) began in Georgia, as UTC ISO
 * timestamps for the XP queries.
 */
export function xpWindows(now: Date = new Date()): {
  weekStart: string;
  monthStart: string;
} {
  const local = new Date(now.getTime() + TBILISI_OFFSET_MS);
  const midnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const weekStart = midnight - daysSinceMonday * DAY_MS - TBILISI_OFFSET_MS;
  const monthStart =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) -
    TBILISI_OFFSET_MS;
  return {
    weekStart: new Date(weekStart).toISOString(),
    monthStart: new Date(monthStart).toISOString(),
  };
}

/** Where a period starts; null for all time. */
export function periodStart(
  period: XpPeriod,
  now: Date = new Date(),
): string | null {
  if (period === 'all') return null;
  const windows = xpWindows(now);
  return period === 'week' ? windows.weekStart : windows.monthStart;
}
