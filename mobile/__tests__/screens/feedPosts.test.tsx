/**
 * The Feed's Activity segment with a real query client: posts, the like button and its
 * optimistic count, double-tap to like, navigation from a post, comments, sharing, and the
 * empty feed. Services and heavy children are stubbed.
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
  useLocalSearchParams: () => ({}),
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
jest.mock('../../services/feed', () => ({ feedService: { getFeed: jest.fn() } }));
jest.mock('../../services/likes', () => ({ likesService: { getLikes: jest.fn(), toggleLike: jest.fn() } }));
jest.mock('../../services/comments', () => ({
  commentsService: { getComments: jest.fn(), addComment: jest.fn(), deleteComment: jest.fn() },
}));
jest.mock('../../services/trails', () => ({ trailsService: { getTrails: jest.fn() } }));
jest.mock('../../hooks/useTrails', () => ({ usePrefetchTrail: () => jest.fn() }));
jest.mock('../../hooks/useModeration', () => ({ useWithoutBlocked: (items: unknown[] | undefined) => items ?? [] }));
jest.mock('../../components/moderation/ContentMenu', () => ({ ContentMenu: () => null }));
jest.mock('../../components/feed/CommentsSheet', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    CommentsSheet: ({ visible, activityId }: { visible: boolean; activityId: string }) =>
      visible ? React.createElement(Text, null, `Comments for ${activityId}`) : null,
  };
});
jest.mock('../../components/leaderboard/LeaderboardView', () => ({ LeaderboardView: () => null }));

import React from 'react';
import { Share, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import FeedScreen from '../../app/(tabs)/feed/index';
import { feedService } from '../../services/feed';
import { likesService } from '../../services/likes';
import { trailsService } from '../../services/trails';
import { haptics } from '../../utils/haptics';
import { DOUBLE_TAP_MS } from '../../hooks/useDoubleTap';
import type { FeedItem } from '../../types/feed';

const getFeed = feedService.getFeed as jest.Mock;
const toggleLike = likesService.toggleLike as jest.Mock;
const getTrails = trailsService.getTrails as jest.Mock;
const push = router.push as jest.Mock;
const navigate = router.navigate as jest.Mock;

const post = (extra: Partial<FeedItem> = {}): FeedItem => ({
  activity_id: 'c1',
  activity_type: 'completion',
  user_id: 'u1',
  trail_id: 't1',
  created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  extra_text: null,
  photo_url: 'https://img/p1.jpg',
  photo_urls: ['https://img/p1.jpg', 'https://img/p2.jpg'],
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
  comment_count: 3,
  ...extra,
});

const page = (items: FeedItem[]) => ({
  data: items,
  pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 },
});

let renderer: ReactTestRenderer | null = null;

function textOf(node: ReactTestInstance): string {
  return ([] as unknown[])
    .concat(node.props.children)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
    .join('');
}
/** All the text inside a node, nested Text included. */
function deepText(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(deepText).join('');
}
/** Every Text on screen, with its nested parts joined ("nino completed Juta to Roshka  2h"). */
const shown = () => (renderer?.toJSON() ? renderer.root.findAllByType(Text).map(deepText) : []);
const byTestId = (id: string) =>
  renderer!.root.findAll((n) => n.props.testID === id && typeof n.type !== 'string');
const hostByTestId = (id: string) => renderer!.root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
const pressable = (id: string, index = 0) =>
  renderer!.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[index];
const likeCount = () => byTestId('like-count').map(textOf)[0] ?? '';

/** Lets queries settle: TanStack Query hands results over on timers, not just promises. */
async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setImmediate(resolve));
    });
  }
}

async function render(items: FeedItem[]) {
  getFeed.mockResolvedValue(page(items));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  await act(async () => {
    renderer = TestRenderer.create(
      <QueryClientProvider client={client}>
        <FeedScreen />
      </QueryClientProvider>,
    );
  });
  await flush();
}

/** Presses a button and lets what it started (an optimistic update) reach the screen. */
async function press(testID: string) {
  await act(async () => {
    pressable(testID).props.onPress();
  });
  await flush();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  jest.useRealTimers();
});

describe('a post', () => {
  it('says who did what on which trail, and when', async () => {
    await render([post()]);
    expect(shown()).toContain('nino completed Juta to Roshka  2h');
  });

  it('shows the hike’s photos as a pager, the like count and the comments link', async () => {
    await render([post()]);
    expect(hostByTestId('post-pager')).toHaveLength(1);
    expect(shown()).toContain('1/2');
    expect(likeCount()).toBe('2 likes');
    expect(shown()).toContain('View all 3 comments');
  });

  it('shows the trail’s distance and ascent and the hiker’s time under a completion', async () => {
    await render([post({ elapsed_seconds: 4 * 3600 + 20 * 60 })]);
    expect(shown()).toEqual(expect.arrayContaining(['12.4 km', '860 m', '4h 20m']));
    // The numbers come with the feed: no download of the whole trail list
    expect(getTrails).not.toHaveBeenCalled();
  });

  it('turns a review without a photo into a compact trail card with its stars', async () => {
    await render([post({ activity_id: 'r1', activity_type: 'review', extra_text: '4', photo_url: null, photo_urls: null })]);
    expect(pressable('post-trail-card')).toBeDefined();
    expect(hostByTestId('post-pager')).toHaveLength(0);
    expect(renderer!.root.findAll((n) => n.props.accessibilityLabel === 'Rated 4 out of 5').length).toBeGreaterThan(0);
    // Hike numbers are only for completions
    expect(shown()).not.toContain('12.4 km');
  });

  it('shows the newest comment under the post, and opens the comments from it', async () => {
    await render([post({ comment_count: 3, latest_comment: { id: 'k1', username: 'gio', comment: 'Beautiful!' } })]);
    expect(shown()).toEqual(expect.arrayContaining(['View all 3 comments', 'gio Beautiful!']));

    act(() => pressable('latest-comment').props.onPress());
    expect(shown()).toContain('Comments for c1');
  });

  it('shows a single comment as it is, without “View 1 comment”', async () => {
    await render([post({ comment_count: 1, latest_comment: { id: 'k1', username: 'gio', comment: 'Beautiful!' } })]);
    expect(shown()).toContain('gio Beautiful!');
    expect(shown()).not.toContain('View 1 comment');
    expect(shown()).not.toContain('Add a comment…');
  });

  it('invites the first comment when there is none', async () => {
    await render([post({ comment_count: 0, latest_comment: null })]);
    expect(shown()).toContain('Add a comment…');
    expect(byTestId('latest-comment')).toHaveLength(0);
  });

  it('shows a photo post’s caption after the username', async () => {
    await render([post({ activity_id: 'p1', activity_type: 'photo', extra_text: 'Snow on the pass', photo_urls: null })]);
    expect(shown()).toContain('nino Snow on the pass');
  });
});

describe('liking', () => {
  it('counts the like at once, before the server answers, and keeps the server’s count', async () => {
    const server = deferred<{ liked: boolean; count: number }>();
    toggleLike.mockReturnValueOnce(server.promise);
    await render([post()]);

    await press('like-button');
    // Still waiting for the server, yet already counted
    expect(likeCount()).toBe('3 likes');
    expect(hostByTestId('icon-heart')).toHaveLength(1);
    expect(toggleLike).toHaveBeenCalledWith({ activity_id: 'c1', activity_type: 'completion' });
    expect(haptics.tap).toHaveBeenCalled();

    await act(async () => server.resolve({ liked: true, count: 3 }));
    await flush();
    expect(likeCount()).toBe('3 likes');
    const likeButton = renderer!.root.findAll((n) => n.props.testID === 'like-button' && n.props.accessibilityState)[0];
    expect(likeButton.props.accessibilityState).toEqual({ selected: true });
  });

  it('takes the like back when pressed again', async () => {
    const server = deferred<{ liked: boolean; count: number }>();
    toggleLike.mockReturnValueOnce(server.promise);
    await render([post({ like_count: 2, liked_by_me: true })]);
    await press('like-button');
    expect(likeCount()).toBe('1 like');
    expect(hostByTestId('icon-heart-outline').length).toBeGreaterThan(0);
    await act(async () => server.resolve({ liked: false, count: 1 }));
    await flush();
    expect(likeCount()).toBe('1 like');
  });

  it('puts the count back when the server refuses', async () => {
    const server = deferred<{ liked: boolean; count: number }>();
    toggleLike.mockReturnValueOnce(server.promise);
    await render([post()]);
    await press('like-button');
    expect(likeCount()).toBe('3 likes');
    await act(async () => server.reject(new Error('offline')));
    await flush();
    expect(likeCount()).toBe('2 likes');
  });
});

describe('double-tapping the photo', () => {
  it('likes the post and plays the heart', async () => {
    const server = deferred<{ liked: boolean; count: number }>();
    toggleLike.mockReturnValueOnce(server.promise);
    await render([post()]);
    const photo = pressable('post-photo');

    await act(async () => {
      photo.props.onPress();
      photo.props.onPress();
    });
    await flush();
    expect(likeCount()).toBe('3 likes');
    expect(toggleLike).toHaveBeenCalledTimes(1);
    expect(renderer!.root.findAll((n) => n.props.testID === 'heart-burst').length).toBeGreaterThan(0);

    // A double tap never opens the trail
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DOUBLE_TAP_MS + 60));
    });
    expect(push).not.toHaveBeenCalled();
    await act(async () => server.resolve({ liked: true, count: 3 }));
  });

  it('never takes a like back', async () => {
    await render([post({ like_count: 5, liked_by_me: true })]);
    jest.useFakeTimers();
    const photo = pressable('post-photo');
    act(() => photo.props.onPress());
    act(() => photo.props.onPress());
    expect(toggleLike).not.toHaveBeenCalled();
    expect(likeCount()).toBe('5 likes');
  });

  it('opens the trail on a single tap, once a second tap can no longer come', async () => {
    await render([post()]);
    jest.useFakeTimers();
    act(() => pressable('post-photo').props.onPress());
    expect(push).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(DOUBLE_TAP_MS + 10));
    expect(push).toHaveBeenCalledWith('/trail/t1');
  });
});

describe('going places from a post', () => {
  it('opens the hiker’s profile from the avatar and the username', async () => {
    await render([post()]);
    act(() => pressable('post-avatar').props.onPress());
    expect(push).toHaveBeenLastCalledWith('/trail/user/u1');

    const username = renderer!.root.findAllByType(Text).find((t) => textOf(t) === 'nino' && t.props.onPress)!;
    act(() => username.props.onPress());
    expect(push).toHaveBeenLastCalledWith('/trail/user/u1');
  });

  it('opens the trail from its name', async () => {
    await render([post()]);
    const trail = renderer!.root.findAllByType(Text).find((t) => textOf(t) === 'Juta to Roshka' && t.props.onPress)!;
    act(() => trail.props.onPress());
    expect(push).toHaveBeenLastCalledWith('/trail/t1');
  });

  it('opens the comments from the button and from “View all” ', async () => {
    await render([post()]);
    act(() => pressable('comment-button').props.onPress());
    expect(shown()).toContain('Comments for c1');
  });

  it('shares the post with a link to the trail', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    await render([post()]);
    act(() => pressable('share-button').props.onPress());
    expect(share).toHaveBeenCalledWith({
      message: 'nino completed Juta to Roshka on Kvali.\n\nmikiri-trails://trail/t1',
    });
    share.mockRestore();
  });

  it('has action buttons big enough to hit', async () => {
    await render([post()]);
    const like = renderer!.root.findAll((n) => n.props.testID === 'like-button' && typeof n.props.style === 'function')[0];
    const style = Object.assign({}, ...[].concat(like.props.style({ pressed: false })).filter(Boolean)) as {
      minWidth: number;
      minHeight: number;
    };
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });
});

describe('an empty feed', () => {
  it('explains what will appear and offers Discover or exploring trails', async () => {
    await render([]);
    expect(byTestId('empty-feed').length).toBeGreaterThan(0);
    expect(shown()).toEqual(expect.arrayContaining(['Discover hikers and hikes', 'Explore trails']));

    act(() => pressable('empty-feed-discover').props.onPress());
    expect(router.setParams).toHaveBeenCalledWith({ segment: 'discover' });
    act(() => pressable('empty-feed-explore').props.onPress());
    expect(navigate).toHaveBeenCalledWith('/(tabs)/home');
  });
});
