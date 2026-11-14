/** Times for the "Back by" check-in: suggestions, quick choices and how they read. */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
/** The server refuses anything sooner. */
export const MIN_AHEAD_MS = 10 * MINUTE;

/** Rounds up to the next half hour: 15:05 → 15:30. */
export function roundUpToHalfHour(date: Date): Date {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  if (minutes === 0 || minutes === 30) return next;
  next.setMinutes(minutes < 30 ? 30 : 60);
  return next;
}

/**
 * A sensible back-by time: the trail's estimated hours and half as much again for rests and
 * the unexpected, at least two hours, rounded up to the half hour.
 */
export function suggestedBackBy(now: Date, estimatedHours: number | null | undefined): Date {
  const hours = Math.max(2, (estimatedHours && estimatedHours > 0 ? estimatedHours : 3) * 1.5);
  return roundUpToHalfHour(new Date(now.getTime() + hours * HOUR));
}

export interface BackByOption {
  key: string;
  label: string;
  date: Date;
}

/** The suggestion first, then a few round choices further out (none that repeat it). */
export function backByOptions(now: Date, estimatedHours: number | null | undefined): BackByOption[] {
  const suggested = suggestedBackBy(now, estimatedHours);
  const options: BackByOption[] = [{ key: 'suggested', label: `${formatClock(suggested)} (suggested)`, date: suggested }];
  for (const hours of [2, 4, 6, 8]) {
    const date = roundUpToHalfHour(new Date(now.getTime() + hours * HOUR));
    if (options.some((o) => o.date.getTime() === date.getTime())) continue;
    options.push({ key: `+${hours}`, label: `In ${hours} h`, date });
  }
  return options;
}

/** A time picked on the clock: today, or tomorrow when that time has passed. */
export function fromPickedTime(now: Date, picked: Date): Date {
  const date = new Date(now);
  date.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  if (date.getTime() < now.getTime() + MIN_AHEAD_MS) date.setDate(date.getDate() + 1);
  return date;
}

/** "18:30" (24-hour, as in Georgia). */
export function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "in 4 h 30 min", "in 45 min", "tomorrow at 07:00". */
export function formatFromNow(now: Date, date: Date): string {
  const minutes = Math.round((date.getTime() - now.getTime()) / MINUTE);
  if (minutes < 0) return 'passed';
  const sameDay = date.toDateString() === now.toDateString();
  if (!sameDay && minutes >= 12 * 60) return `tomorrow at ${formatClock(date)}`;
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `in ${h} h` : `in ${h} h ${m} min`;
}

/** An hour after the later of now and the current time: "Add 1 hour". */
export function oneHourLater(now: Date, backBy: Date): Date {
  return new Date(Math.max(now.getTime(), backBy.getTime()) + HOUR);
}
