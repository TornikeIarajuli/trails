/** Instagram-style sections and times for the notification list. Pure, so it can be tested. */

export interface Groupable {
  id: string;
  created_at: string;
  read_at: string | null;
}

export interface NotificationSection<T> {
  key: 'new' | 'today' | 'yesterday' | 'week' | 'month' | 'earlier';
  title: string;
  data: T[];
}

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * "New" holds what was unread when the screen opened (or arrived since); the rest goes by age:
 * Today, Yesterday, This week, This month, Earlier. Empty sections are left out, order is kept.
 */
export function groupNotifications<T extends Groupable>(
  items: T[],
  freshIds: ReadonlySet<string>,
  now = Date.now(),
): NotificationSection<T>[] {
  const today = startOfDay(now);
  const sections: NotificationSection<T>[] = [
    { key: 'new', title: 'New', data: [] },
    { key: 'today', title: 'Today', data: [] },
    { key: 'yesterday', title: 'Yesterday', data: [] },
    { key: 'week', title: 'This week', data: [] },
    { key: 'month', title: 'This month', data: [] },
    { key: 'earlier', title: 'Earlier', data: [] },
  ];
  const byKey = Object.fromEntries(sections.map((s) => [s.key, s])) as Record<NotificationSection<T>['key'], NotificationSection<T>>;

  for (const item of items) {
    if (freshIds.has(item.id) || !item.read_at) {
      byKey.new.data.push(item);
      continue;
    }
    const at = new Date(item.created_at).getTime();
    if (!Number.isFinite(at) || at >= today) byKey.today.data.push(item);
    else if (at >= today - DAY) byKey.yesterday.data.push(item);
    else if (at >= today - 6 * DAY) byKey.week.data.push(item);
    else if (at >= today - 29 * DAY) byKey.month.data.push(item);
    else byKey.earlier.data.push(item);
  }
  return sections.filter((s) => s.data.length > 0);
}

/** Compact age like Instagram: now, 5m, 2h, 3d, 2w, then the date. */
export function shortTimeAgo(createdAt: string, now = Date.now()): string {
  const at = new Date(createdAt).getTime();
  if (!Number.isFinite(at)) return '';
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 35) return `${Math.floor(days / 7)}w`;
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Splits a notification body so the person's name can be bold: "nino started following you"
 * → { name: "nino", rest: " started following you" }. Null when the body does not start with it.
 */
export function splitActorName(body: string, username: string | null | undefined): { name: string; rest: string } | null {
  if (!username || !body.startsWith(username)) return null;
  return { name: username, rest: body.slice(username.length) };
}
