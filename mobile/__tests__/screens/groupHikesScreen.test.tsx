const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  Stack: { Screen: () => null },
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../store/authStore', () => ({
  useAuthStore: (sel: (s: { isAuthenticated: boolean; user: { id: string } }) => unknown) =>
    sel({ isAuthenticated: true, user: { id: 'me' } }),
}));
jest.mock('../../hooks/useModeration', () => ({ useWithoutBlocked: (items: unknown[] | undefined) => items ?? [] }));
jest.mock('../../hooks/useTrails', () => ({
  useTrails: () => ({ data: { pages: [{ data: [{ id: 't1', name_en: 'Juta to Roshka', region: 'Kazbegi' }] }] }, isLoading: false }),
}));
const mockEvents: { data: unknown[] | undefined } = { data: [] };
const mockMine: { data: unknown[] | undefined } = { data: [] };
jest.mock('../../hooks/useEvents', () => ({
  useUpcomingEvents: () => ({ data: mockEvents.data, isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false }),
  useMyEvents: () => ({ data: mockMine.data }),
}));

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import GroupHikesScreen from '../../app/trail/group-hikes';

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat().filter((c) => typeof c === 'string' || typeof c === 'number').join(''));

/** Presses the nearest pressable around the text shown. */
function pressText(r: ReactTestRenderer, label: string) {
  const node = r.root.findAllByType(Text).find((t) => [t.props.children].flat().join('') === label);
  let current = node?.parent ?? null;
  while (current && typeof current.props.onPress !== 'function') current = current.parent;
  if (!current) throw new Error('No pressable around ' + label);
  act(() => {
    current!.props.onPress();
  });
}

function render() {
  let r!: ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<GroupHikesScreen />);
  });
  return r;
}

describe('Group hikes screen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockMine.data = [];
  });

  it('puts your own trips first, private ones too, without listing them twice', () => {
    const later = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const trip = {
      id: 'e7',
      trail_id: 't1',
      organizer_id: 'u1',
      title: 'Svaneti in three days',
      description: null,
      scheduled_at: later,
      max_participants: null,
      created_at: later,
      visibility: 'private',
      days: [{ day_number: 2 }, { day_number: 3 }],
      organizer: { id: 'u1', username: 'me', avatar_url: null },
      trails: { id: 't1', name_en: 'Juta to Roshka', region: 'Kazbegi' },
      participants: [{ user_id: 'u1' }],
    };
    mockMine.data = [trip];
    mockEvents.data = [{ ...trip, id: 'e8', title: 'Someone else', visibility: 'public', days: [] }];
    const r = render();
    const shown = texts(r);
    expect(shown.indexOf('Your trips and hikes')).toBeLessThan(shown.indexOf('Svaneti in three days'));
    expect(shown.filter((t) => t === 'Svaneti in three days')).toHaveLength(1);
    expect(shown.some((t) => /· 3 days · Private$/.test(t))).toBe(true);
    expect(shown).toContain('Someone else');
  });

  it('lists upcoming hikes with who is going and the user’s own', () => {
    const soon = new Date(Date.now() + 2 * 3_600_000).toISOString();
    mockEvents.data = [
      {
        id: 'e1',
        trail_id: 't1',
        organizer_id: 'u2',
        title: 'Sunrise at Juta',
        scheduled_at: soon,
        max_participants: null,
        organizer: { id: 'u2', username: 'nino', avatar_url: null },
        trails: { id: 't1', name_en: 'Juta to Roshka', region: 'Kazbegi', cover_image_url: null },
        participant_count: [{ count: 2 }],
        participants: [{ user_id: 'u2' }, { user_id: 'me' }],
      },
    ];
    const r = render();
    const shown = texts(r).join(' | ');
    expect(shown).toContain('This week');
    expect(shown).toContain('Sunrise at Juta');
    expect(shown).toContain('Juta to Roshka · Kazbegi');
    expect(shown).toContain('2 going · by nino');
    expect(shown).toContain('Joined');
  });

  it('invites planning one when there are none, through a trail picker', () => {
    mockEvents.data = [];
    const r = render();
    expect(texts(r)).toEqual(expect.arrayContaining(['No group hikes planned yet', 'Plan a group hike']));
    pressText(r, 'Plan a group hike');
    pressText(r, 'Juta to Roshka');
    expect(mockPush).toHaveBeenCalledWith('/trail/t1/events?create=1');
  });
});
