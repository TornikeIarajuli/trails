const mockMarkAll = jest.fn();
const mockRefetch = jest.fn(() => Promise.resolve());
let mockFocus: (() => void) | null = null;

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void) => {
    mockFocus = cb;
  },
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('../../store/authStore', () => ({ useAuthStore: (sel: (s: { isAuthenticated: boolean }) => unknown) => sel({ isAuthenticated: true }) }));
jest.mock('../../hooks/useNotifications', () => ({ useMarkAllRead: () => ({ mutate: mockMarkAll }) }));
jest.mock('../../hooks/useFollows', () => ({
  useIsFollowing: () => ({ data: { following: false } }),
  useToggleFollow: () => ({ mutate: jest.fn(), isPending: false }),
}));

// Built on first use: jest.mock factories run before this file's own constants are set
let mockPageCache: unknown;
function mockPage() {
  if (mockPageCache) return mockPageCache;
  const now = new Date().toISOString();
  mockPageCache = {
  unreadCount: 1,
  total: 2,
  data: [
    {
      id: 'n1',
      type: 'new_follower',
      title: 'New follower',
      body: 'nino started following you',
      data: { followerId: 'u1' },
      read_at: null,
      created_at: now,
      actor: { id: 'u1', username: 'nino', avatar_url: null },
      trail: null,
      badge: null,
    },
    {
      id: 'n2',
      type: 'completion_approved',
      title: 'Hike approved',
      body: 'Your hike on Juta was approved.',
      data: { completionId: 'c1', trailId: 't1' },
      read_at: now,
      created_at: now,
      actor: null,
      trail: { id: 't1', name_en: 'Juta', cover_image_url: 'https://x/juta.webp' },
      badge: null,
    },
  ],
  };
  return mockPageCache;
}
jest.mock('../../hooks/useNotificationCenter', () => ({
  useNotificationFeed: () => ({
    data: { pages: [mockPage()] },
    isLoading: false,
    isError: false,
    refetch: mockRefetch,
    isRefetching: false,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
}));

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import AlertsScreen from '../../app/(tabs)/alerts/index';

const texts = (r: ReactTestRenderer) => r.root.findAllByType(Text).map((t) => [t.props.children].flat().filter((c) => typeof c === 'string').join(''));

describe('Alerts screen', () => {
  beforeEach(() => {
    mockMarkAll.mockClear();
    mockFocus = null;
  });

  it('marks everything read when opened, keeping what was new under "New"', async () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<AlertsScreen />);
    });
    expect(mockMarkAll).not.toHaveBeenCalled();
    await act(async () => {
      mockFocus?.();
      await Promise.resolve();
    });
    expect(mockMarkAll).toHaveBeenCalledTimes(1);
    const shown = texts(r);
    expect(shown).toEqual(expect.arrayContaining(['New', 'Today', 'nino', 'Follow back']));
  });

  it('writes the person in bold and system notifications as a sentence', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<AlertsScreen />);
    });
    const shown = texts(r);
    expect(shown).toContain('nino');
    expect(shown.some((t) => t.includes('Your hike on Juta was approved.'))).toBe(true);
  });
});
