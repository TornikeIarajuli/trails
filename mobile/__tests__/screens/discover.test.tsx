/**
 * Discover, the Feed's second segment: hikers to follow (with why), following them from the
 * card, everyone's posts, and what shows when nobody has posted yet.
 */
const mockSecureStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), setParams: jest.fn() },
}));
jest.mock('../../utils/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('../../utils/haptics', () => ({
  haptics: { tap: jest.fn(), select: jest.fn(), success: jest.fn(), warning: jest.fn() },
}));
jest.mock('../../components/ui/Icon', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Icon: ({ name }: { name: string }) => React.createElement(Text, { testID: `icon-${name}` }) };
});
jest.mock('../../hooks/useModeration', () => ({ useWithoutBlocked: (items: unknown[] | undefined) => items ?? [] }));
jest.mock('../../components/feed/ActivityCard', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    ActivityCard: ({ item }: { item: { activity_id: string; user_username: string } }) =>
      React.createElement(Text, null, `Post ${item.activity_id} by ${item.user_username}`),
  };
});
jest.mock('../../services/feed', () => ({ feedService: { getDiscover: jest.fn(), getFeed: jest.fn() } }));
jest.mock('../../services/users', () => ({ usersService: { getSuggestedHikers: jest.fn() } }));
jest.mock('../../services/follows', () => ({ followsService: { toggle: jest.fn() } }));

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import { DiscoverList } from '../../components/feed/DiscoverList';
import { suggestionReason } from '../../components/feed/SuggestedHikers';
import { feedService } from '../../services/feed';
import { usersService } from '../../services/users';
import { followsService } from '../../services/follows';

const getDiscover = feedService.getDiscover as jest.Mock;
const getSuggested = usersService.getSuggestedHikers as jest.Mock;
const toggleFollow = followsService.toggle as jest.Mock;

const hiker = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  username: id,
  full_name: null,
  avatar_url: null,
  total_trails_completed: 0,
  followed_by: null,
  mutual_count: 0,
  ...extra,
});

const post = (id: string, username: string) => ({
  activity_id: id,
  activity_type: 'completion',
  user_id: `u-${username}`,
  trail_id: 't1',
  created_at: '2026-11-14T08:00:00Z',
  extra_text: null,
  photo_url: null,
  photo_urls: null,
  user_username: username,
  user_full_name: null,
  user_avatar_url: null,
  trail_name_en: 'Juta to Roshka',
  trail_name_ka: null,
  trail_cover_image_url: null,
});

const page = (items: unknown[]) => ({ data: items, pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 } });

let renderer: ReactTestRenderer | null = null;

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
const shown = () => (renderer?.toJSON() ? renderer.root.findAllByType(Text).map(deepText) : []);
const pressable = (id: string) =>
  renderer!.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setImmediate(resolve));
    });
  }
}

async function render() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  await act(async () => {
    renderer = TestRenderer.create(
      <QueryClientProvider client={client}>
        <DiscoverList />
      </QueryClientProvider>,
    );
  });
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('suggestionReason', () => {
  it('says who you know who follows them, then their hikes, then that they are new', () => {
    expect(suggestionReason({ followed_by: 'nino', mutual_count: 1, total_trails_completed: 4 })).toBe('Followed by nino');
    expect(suggestionReason({ followed_by: 'nino', mutual_count: 3, total_trails_completed: 0 })).toBe(
      'Followed by nino + 2 more',
    );
    expect(suggestionReason({ followed_by: null, mutual_count: 0, total_trails_completed: 1 })).toBe('1 hike');
    expect(suggestionReason({ followed_by: null, mutual_count: 0, total_trails_completed: 9 })).toBe('9 hikes');
    expect(suggestionReason({ followed_by: null, mutual_count: 0, total_trails_completed: 0 })).toBe('New on Mikiri');
  });
});

describe('Discover', () => {
  it('shows hikers to follow above the posts of everyone', async () => {
    getSuggested.mockResolvedValue([
      hiker('gio', { followed_by: 'nino', mutual_count: 1 }),
      hiker('ana', { total_trails_completed: 9 }),
    ]);
    getDiscover.mockResolvedValue(page([post('p1', 'gio'), post('p2', 'ana')]));
    await render();

    expect(shown()).toEqual(
      expect.arrayContaining([
        'Hikers to follow',
        'gio',
        'Followed by nino',
        'ana',
        '9 hikes',
        'Popular now',
        'Post p1 by gio',
        'Post p2 by ana',
      ]),
    );
    expect(getDiscover).toHaveBeenCalledWith(1);
  });

  it('follows from the card, and keeps the card showing "Following"', async () => {
    toggleFollow.mockResolvedValue({ following: true });
    getSuggested.mockResolvedValue([hiker('gio')]);
    getDiscover.mockResolvedValue(page([]));
    await render();

    await act(async () => pressable('follow-gio').props.onPress());
    await flush();

    expect(toggleFollow).toHaveBeenCalledWith('gio');
    expect(shown()).toContain('Following');
    expect(shown()).toContain('gio');
  });

  it('goes back to "Follow" when following fails', async () => {
    toggleFollow.mockRejectedValue(new Error('offline'));
    getSuggested.mockResolvedValue([hiker('gio')]);
    getDiscover.mockResolvedValue(page([]));
    await render();

    await act(async () => pressable('follow-gio').props.onPress());
    await flush();

    expect(shown()).toContain('Follow');
    expect(shown()).not.toContain('Following');
  });

  it('opens a profile from its card, and search from the title', async () => {
    getSuggested.mockResolvedValue([hiker('gio')]);
    getDiscover.mockResolvedValue(page([]));
    await render();

    act(() => pressable('suggested-gio').props.onPress());
    expect(router.push).toHaveBeenCalledWith('/trail/user/gio');
    act(() => pressable('suggested-search').props.onPress());
    expect(router.push).toHaveBeenCalledWith('/search');
  });

  it('says so when nobody has shared a hike yet, and leaves out an empty suggestions row', async () => {
    getSuggested.mockResolvedValue([]);
    getDiscover.mockResolvedValue(page([]));
    await render();

    expect(shown()).toContain('No hikes shared yet');
    expect(shown()).not.toContain('Hikers to follow');
  });
});
