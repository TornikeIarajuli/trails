import { dayDate, daysForApi, inviteMessage, isPrivate, itinerary, messageTime, tripLength, tripLengthLabel } from '../../utils/trips';

const start = '2026-11-28T05:00:00.000Z';

describe('trips', () => {
  const event = {
    id: 'e1',
    title: 'Svaneti in three days',
    scheduled_at: start,
    trail_id: 't1',
    trails: { id: 't1', name_en: 'Mestia to Zhabeshi' },
    days: [
      { day_number: 3, trail_id: 't3', title: null, note: null, trails: { id: 't3', name_en: 'Ushguli to Shkhara glacier' } },
      { day_number: 2, trail_id: null, title: 'Rest day in Mestia', note: 'Museum, then the tower', trails: null },
    ],
  };

  it('counts the days: day 1 plus the further ones', () => {
    expect(tripLength(event)).toBe(3);
    expect(tripLengthLabel(event)).toBe('3 days');
    expect(tripLength({ days: [] })).toBe(1);
    expect(tripLengthLabel({ days: undefined })).toBeNull();
  });

  it('lists every day in order, one calendar day apart', () => {
    const days = itinerary(event);
    expect(days.map((d) => [d.dayNumber, d.label, d.trailId, d.note])).toEqual([
      [1, 'Mestia to Zhabeshi', 't1', null],
      [2, 'Rest day in Mestia', null, 'Museum, then the tower'],
      [3, 'Ushguli to Shkhara glacier', 't3', null],
    ]);
    expect(days[2].date.toISOString()).toBe('2026-11-30T05:00:00.000Z');
    expect(dayDate(start, 1).toISOString()).toBe(start);
  });

  it('shares an invite that opens the trip in the app, and tells private from public', () => {
    expect(inviteMessage(event)).toBe('Join "Svaneti in three days" on Kvali:\nmikiri-trails://trail/t1/event/e1');
    expect(isPrivate({ visibility: 'private' })).toBe(true);
    expect(isPrivate({})).toBe(false);
  });

  it('sends further days as the API takes them, and refuses a free day without a name', () => {
    const base = { key: 'k', trailName: null, note: '' };
    expect(
      daysForApi([
        { ...base, trailId: 't2', trailName: 'Truso', title: '' },
        { ...base, trailId: null, title: '  Rest day ', note: ' Sleep in Juta ' },
      ]),
    ).toEqual([{ trail_id: 't2' }, { title: 'Rest day', note: 'Sleep in Juta' }]);
    expect(daysForApi([{ ...base, trailId: null, title: '  ' }])).toBeNull();
    expect(daysForApi([])).toEqual([]);
  });
});

describe('messageTime', () => {
  const now = new Date(2026, 10, 20, 15, 0).getTime(); // Fri 20 Nov, 15:00 (phone time)

  it('shows the time today, the weekday this week, and the date before', () => {
    expect(messageTime(new Date(2026, 10, 20, 9, 41).toISOString(), now)).toBe('09:41');
    expect(messageTime(new Date(2026, 10, 17, 18, 5).toISOString(), now)).toBe('Tue 18:05');
    expect(messageTime(new Date(2026, 10, 2, 7, 0).toISOString(), now)).toBe('2 Nov 07:00');
  });
});
