/** Helpers for listing group hikes across trails. Pure, so they can be tested. */

interface HikeLike {
  scheduled_at: string;
  max_participants: number | null;
  participant_count?: [{ count: number }];
  participants?: { user_id: string }[];
}

export function participantCount(event: HikeLike): number {
  return event.participant_count?.[0]?.count ?? event.participants?.length ?? 0;
}

export function hasJoined(event: HikeLike, userId: string | null | undefined): boolean {
  return !!userId && (event.participants ?? []).some((p) => p.user_id === userId);
}

/** Places left, or null when the hike has no limit. */
export function spotsLeft(event: HikeLike): number | null {
  if (event.max_participants == null) return null;
  return Math.max(0, event.max_participants - participantCount(event));
}

/** "Sat 22 Nov · 08:00" in the phone's time zone. */
export function hikeDateLabel(scheduledAt: string): string {
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

export interface HikeSection<T> {
  key: 'week' | 'next' | 'later';
  title: string;
  data: T[];
}

/** This week (until Sunday night), Next week, Later. Empty sections are left out; order is kept. */
export function groupUpcomingHikes<T extends HikeLike>(events: T[], now = Date.now()): HikeSection<T>[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  // Monday-based weeks: days until the end of Sunday
  const daysToSunday = (7 - start.getDay()) % 7;
  const endOfWeek = start.getTime() + (daysToSunday + 1) * 86_400_000;
  const endOfNextWeek = endOfWeek + 7 * 86_400_000;

  const sections: HikeSection<T>[] = [
    { key: 'week', title: 'This week', data: [] },
    { key: 'next', title: 'Next week', data: [] },
    { key: 'later', title: 'Later', data: [] },
  ];
  for (const event of events) {
    const at = new Date(event.scheduled_at).getTime();
    if (at < endOfWeek) sections[0].data.push(event);
    else if (at < endOfNextWeek) sections[1].data.push(event);
    else sections[2].data.push(event);
  }
  return sections.filter((s) => s.data.length > 0);
}
