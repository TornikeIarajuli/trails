import { groupNotifications, shortTimeAgo, splitActorName } from '../../utils/notificationGroups';

const NOW = new Date(2026, 10, 14, 15, 0, 0).getTime(); // 14 Nov 2026, 15:00 local
const at = (daysAgo: number, hour = 12) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const n = (id: string, created_at: string, read = true) => ({ id, created_at, read_at: read ? created_at : null });

describe('groupNotifications', () => {
  it('puts what was unread at opening under New, the rest by age', () => {
    const items = [
      n('fresh-read', at(0, 14)), // read on the server now, but unread when the screen opened
      n('unread', at(3), false),
      n('today', at(0, 9)),
      n('yesterday', at(1)),
      n('week', at(5)),
      n('month', at(20)),
      n('old', at(60)),
    ];
    const sections = groupNotifications(items, new Set(['fresh-read']), NOW);
    expect(sections.map((s) => [s.title, s.data.map((x) => x.id)])).toEqual([
      ['New', ['fresh-read', 'unread']],
      ['Today', ['today']],
      ['Yesterday', ['yesterday']],
      ['This week', ['week']],
      ['This month', ['month']],
      ['Earlier', ['old']],
    ]);
  });

  it('leaves out empty sections', () => {
    expect(groupNotifications([n('a', at(0, 10))], new Set(), NOW).map((s) => s.title)).toEqual(['Today']);
    expect(groupNotifications([], new Set(), NOW)).toEqual([]);
  });
});

describe('shortTimeAgo', () => {
  it('writes compact ages', () => {
    expect(shortTimeAgo(new Date(NOW - 20_000).toISOString(), NOW)).toBe('now');
    expect(shortTimeAgo(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe('5m');
    expect(shortTimeAgo(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe('3h');
    expect(shortTimeAgo(new Date(NOW - 2 * 86_400_000).toISOString(), NOW)).toBe('2d');
    expect(shortTimeAgo(new Date(NOW - 15 * 86_400_000).toISOString(), NOW)).toBe('2w');
    expect(shortTimeAgo(new Date(2026, 6, 3).toISOString(), NOW)).toBe('3 Jul');
    expect(shortTimeAgo('not a date', NOW)).toBe('');
  });
});

describe('splitActorName', () => {
  it('splits off the name the body starts with', () => {
    expect(splitActorName('nino started following you', 'nino')).toEqual({ name: 'nino', rest: ' started following you' });
    expect(splitActorName('Your hike was approved', 'nino')).toBeNull();
    expect(splitActorName('nino started following you', null)).toBeNull();
  });
});
