/**
 * The post screen that like and comment notifications open: the post as in the feed, its
 * comments opened by themselves for a comment, a deleted post leading to its trail, and likes
 * counted at once on this screen too.
 */
const mockSecureStore = new Map<string, string>();
const mockParams: { id: string; comments?: string; trailId?: string } = { id: 'c1' };

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
  router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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
jest.mock('../../services/feed', () => ({ feedService: { getFeed: jest.fn(), getPost: jest.fn() } }));
jest.mock('../../services/likes', () => ({ likesService: { getLikes: jest.fn(), toggleLike: jest.fn() } }));
jest.mock('../../services/comments', () => ({
  commentsService: { getComments: jest.fn(), addComment: jest.fn(), deleteComment: jest.fn() },
}));
jest.mock('../../hooks/useTrails', () => ({ usePrefetchTrail: () => jest.fn() }));
jest.mock('../../components/moderation/ContentMenu', () => ({ ContentMenu: () => null }));
jest.mock('../../components/feed/CommentsSheet', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    CommentsSheet: ({ visible, activityId }: { visible: boolean; activityId: string }) =>
      visible ? React.createElement(Text, null, `Comments for ${activityId}`) : null,
  };
});

import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import PostScreen from '../../app/trail/post/[id]';
import { COMMENTS_OPEN_DELAY_MS } from '../../components/feed/ActivityCard';
import { feedService } from '../../services/feed';
import { likesService } from '../../services/likes';
import type { FeedItem } from '../../types/feed';

const getPost = feedService.getPost as jest.Mock;
const toggleLike = likesService.toggleLike as jest.Mock;

const post = (extra: Partial<FeedItem> = {}): FeedItem => ({
  activity_id: 'c1',
  activity_type: 'completion',
  user_id: 'u1',
  trail_id: 't1',
  created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  extra_text: null,
  photo_url: 'https://img/p1.jpg',
  photo_urls: ['https://img/p1.jpg'],
  user_username: 'nino',
  user_full_name: 'Nino B',
  user_avatar_url: null,
  trail_name_en: 'Juta to Roshka',
  trail_name_ka: null,
  trail_cover_image_url: null,
  trail_distance_km: 12.4,
  trail_elevation_gain_m: 860,
  like_count: 2,
  liked_by_me: false,
  comment_count: 1,
  ...extra,
});

let renderer: ReactTestRenderer | null = null;

function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
const shown = () => (renderer?.toJSON() ? renderer.root.findAllByType(Text).map(deepText) : []);
const pressable = (id: string) =>
  renderer!.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];
const likeCount = () => renderer!.root.findAll((n) => n.props.testID === 'like-count' && typeof n.type !== 'string').map(deepText)[0] ?? '';

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
        <PostScreen />
      </QueryClientProvider>,
    );
  });
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.id = 'c1';
  delete mockParams.comments;
  delete mockParams.trailId;
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('the post screen', () => {
  it('shows the post the notification is about', async () => {
    getPost.mockResolvedValue(post());
    await render();

    expect(getPost).toHaveBeenCalledWith('c1');
    expect(shown()).toContain('nino completed Juta to Roshka  2h');
    expect(likeCount()).toBe('2 likes');
    expect(shown()).toEqual(expect.arrayContaining(['12.4 km', '860 m']));
  });

  it('opens the comments by itself when a comment notification opened it', async () => {
    mockParams.comments = '1';
    getPost.mockResolvedValue(post());
    await render();
    expect(shown()).not.toContain('Comments for c1');

    // Once the screen has slid in
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, COMMENTS_OPEN_DELAY_MS + 50));
    });
    expect(shown()).toContain('Comments for c1');
  });

  it('keeps the comments closed for a like notification', async () => {
    getPost.mockResolvedValue(post());
    await render();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, COMMENTS_OPEN_DELAY_MS + 50));
    });
    expect(shown()).not.toContain('Comments for c1');
  });

  it('counts a like at once on this screen too', async () => {
    let answer!: (value: { liked: boolean; count: number }) => void;
    toggleLike.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    getPost.mockResolvedValue(post());
    await render();

    await act(async () => {
      pressable('like-button').props.onPress();
    });
    await flush();
    expect(likeCount()).toBe('3 likes');

    await act(async () => answer({ liked: true, count: 3 }));
    await flush();
    expect(likeCount()).toBe('3 likes');
  });

  it('says when the post is gone and still leads to its trail', async () => {
    mockParams.trailId = 't1';
    getPost.mockRejectedValue({ response: { status: 404 }, message: 'Not found' });
    await render();

    expect(shown()).toContain('This post is no longer available');
    act(() => pressable('post-gone-open-trail').props.onPress());
    expect(router.replace).toHaveBeenCalledWith('/trail/t1');
  });

  it('offers to retry when the post could not be loaded', async () => {
    getPost.mockRejectedValue({ response: { status: 500 }, message: 'Server error' });
    await render();

    expect(shown()).toContain("Couldn't load this post");
    expect(shown()).not.toContain('This post is no longer available');
  });
});
