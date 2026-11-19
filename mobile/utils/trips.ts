/**
 * Trips: group hikes with more than one day. Day 1 is the event's own trail and date; the
 * further days (event_days) follow, one calendar day apart.
 */
import type { EventVisibility, TrailEvent, TripDay } from '../services/events';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many days the trip lasts: day 1 plus its further days. */
export function tripLength(event: Pick<TrailEvent, 'days'>): number {
  const numbers = (event.days ?? []).map((d) => d.day_number);
  return Math.max(1, ...numbers);
}

/** The date of a day of the trip (day 1 is the start). */
export function dayDate(scheduledAt: string, dayNumber: number): Date {
  return new Date(Date.parse(scheduledAt) + (dayNumber - 1) * DAY_MS);
}

export interface ItineraryDay {
  dayNumber: number;
  date: Date;
  trailId: string | null;
  /** The trail's name, or the day's own title ("Rest day in Mestia"). */
  label: string;
  note: string | null;
}

/** Every day of the trip in order, day 1 included. */
export function itinerary(
  event: Pick<TrailEvent, 'scheduled_at' | 'trail_id' | 'trails'> & { days?: TripDay[] },
): ItineraryDay[] {
  const first: ItineraryDay = {
    dayNumber: 1,
    date: dayDate(event.scheduled_at, 1),
    trailId: event.trail_id,
    label: event.trails?.name_en ?? 'Trail',
    note: null,
  };
  const rest = [...(event.days ?? [])]
    .sort((a, b) => a.day_number - b.day_number)
    .map((d) => ({
      dayNumber: d.day_number,
      date: dayDate(event.scheduled_at, d.day_number),
      trailId: d.trail_id,
      label: d.trails?.name_en ?? d.title ?? (d.trail_id ? 'Trail' : 'Free day'),
      note: d.note,
    }));
  return [first, ...rest];
}

/** "3 days" chip text; null for a one-day hike. */
export function tripLengthLabel(event: Pick<TrailEvent, 'days'>): string | null {
  const days = tripLength(event);
  return days > 1 ? `${days} days` : null;
}

export function isPrivate(event: { visibility?: EventVisibility }): boolean {
  return event.visibility === 'private';
}

/** The invite people share: the trip's name and the link that opens it in the app. */
export function inviteMessage(event: Pick<TrailEvent, 'id' | 'trail_id' | 'title'>): string {
  return `Join "${event.title}" on Kvali:\nmikiri-trails://trail/${event.trail_id}/event/${event.id}`;
}

/** "09:41" today, "Sat 09:41" this week, "23 Nov 09:41" before. */
export function messageTime(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return time;
  if (now - d.getTime() < 6 * 24 * 3600 * 1000) {
    return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${time}`;
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${time}`;
}

/** A further day while the form is being filled in. */
export interface DraftDay {
  key: string;
  trailId: string | null;
  trailName: string | null;
  /** For a day without a trail. */
  title: string;
  note: string;
}

/** The further days as the API takes them; null when a day without a trail has no title. */
export function daysForApi(days: DraftDay[]): { trail_id?: string; title?: string; note?: string }[] | null {
  if (days.some((d) => !d.trailId && !d.title.trim())) return null;
  return days.map((d) => ({
    ...(d.trailId ? { trail_id: d.trailId } : { title: d.title.trim() }),
    ...(d.note.trim() ? { note: d.note.trim() } : {}),
  }));
}
