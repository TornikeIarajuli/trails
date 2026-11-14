import { groupUpcomingHikes, hasJoined, hikeDateLabel, participantCount, spotsLeft } from '../../utils/groupHikes';

// Wednesday 12 Nov 2026, 10:00 local
const NOW = new Date(2026, 10, 12, 10, 0, 0).getTime();
const on = (y: number, m: number, d: number, h = 8) => new Date(y, m, d, h, 0, 0).toISOString();
const hike = (id: string, scheduled_at: string, extra: object = {}) => ({ id, scheduled_at, max_participants: null, ...extra });

describe('group hike helpers', () => {
  it('counts who is going and whether the user joined', () => {
    const e = hike('a', on(2026, 10, 15), { participant_count: [{ count: 3 }], participants: [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }] });
    expect(participantCount(e)).toBe(3);
    expect(hasJoined(e, 'u2')).toBe(true);
    expect(hasJoined(e, 'u9')).toBe(false);
    expect(hasJoined(e, null)).toBe(false);
    expect(participantCount(hike('b', on(2026, 10, 15), { participants: [{ user_id: 'u1' }] }))).toBe(1);
  });

  it('works out places left', () => {
    expect(spotsLeft(hike('a', on(2026, 10, 15), { max_participants: 5, participant_count: [{ count: 3 }] }))).toBe(2);
    expect(spotsLeft(hike('a', on(2026, 10, 15), { max_participants: 3, participant_count: [{ count: 4 }] }))).toBe(0);
    expect(spotsLeft(hike('a', on(2026, 10, 15)))).toBeNull();
  });

  it('labels the day and time', () => {
    expect(hikeDateLabel(on(2026, 10, 22, 8))).toBe('Sun 22 Nov · 08:00');
    expect(hikeDateLabel('nope')).toBe('');
  });

  it('groups into this week, next week and later', () => {
    const sections = groupUpcomingHikes(
      [
        hike('sat', on(2026, 10, 14)), // this Saturday
        hike('sun', on(2026, 10, 15, 20)), // this Sunday evening
        hike('mon', on(2026, 10, 16)), // next Monday
        hike('sun2', on(2026, 10, 22)), // next Sunday
        hike('dec', on(2026, 11, 5)),
      ],
      NOW,
    );
    expect(sections.map((s) => [s.title, s.data.map((e) => e.id)])).toEqual([
      ['This week', ['sat', 'sun']],
      ['Next week', ['mon', 'sun2']],
      ['Later', ['dec']],
    ]);
    expect(groupUpcomingHikes([], NOW)).toEqual([]);
  });
});
