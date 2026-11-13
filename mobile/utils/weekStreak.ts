const DAY_MS = 86_400_000;

/**
 * Sequential number of the ISO-8601 week (Monday–Sunday) that contains `date` in
 * the device's local calendar. Unlike a "week of the year" number it keeps
 * counting across years, so the last week of December and the first week of
 * January differ by exactly one.
 */
export function isoWeekIndex(date: Date): number {
  // Use the local calendar day as a UTC timestamp so DST shifts cannot move it
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
  // 1970-01-01 was a Thursday, so its ISO week started on Monday 1969-12-29 (day -3)
  return Math.floor((day + 3) / 7);
}

/**
 * Longest run of consecutive ISO weeks that each contain at least one of the
 * given dates.
 */
export function bestWeekStreak(dates: (string | Date | null | undefined)[]): number {
  const weeks = new Set<number>();
  for (const value of dates) {
    if (!value) continue;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    weeks.add(isoWeekIndex(date));
  }

  const sorted = Array.from(weeks).sort((a, b) => a - b);
  let best = 0;
  let current = 0;
  for (let i = 0; i < sorted.length; i++) {
    current = i > 0 && sorted[i] === sorted[i - 1] + 1 ? current + 1 : 1;
    best = Math.max(best, current);
  }
  return best;
}
