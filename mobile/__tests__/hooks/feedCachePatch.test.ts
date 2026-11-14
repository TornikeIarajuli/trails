/**
 * A like or comment on a post updates it wherever it is cached: the Following feed, Discover,
 * and its own post screen, so the same post never shows two different counts.
 */
jest.mock('../../services/feed', () => ({ feedService: {} }));
jest.mock('../../services/users', () => ({ usersService: {} }));

import { QueryClient } from '@tanstack/react-query';
import { findCachedFeedItem, patchFeedItem } from '../../hooks/useFeed';
import { queryKeys } from '../../utils/queryKeys';
import { withLikeToggled } from '../../utils/feedCache';
import type { FeedItem } from '../../types/feed';

const item = (id: string, likes: number): FeedItem => ({
  activity_id: id,
  activity_type: 'completion',
  user_id: 'u1',
  trail_id: 't1',
  created_at: '2026-11-14T08:00:00Z',
  extra_text: null,
  photo_url: null,
  photo_urls: null,
  user_username: 'nino',
  user_full_name: null,
  user_avatar_url: null,
  trail_name_en: 'Gergeti',
  trail_name_ka: null,
  trail_cover_image_url: null,
  like_count: likes,
  liked_by_me: false,
});

const pages = (items: FeedItem[]) => ({
  pages: [{ data: items, pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 } }],
  pageParams: [1],
});

type Pages = ReturnType<typeof pages>;

it('patches the post in Following, Discover and its own screen at once', () => {
  const client = new QueryClient();
  client.setQueryData(queryKeys.feed(), pages([item('a', 2)]));
  client.setQueryData(queryKeys.feedDiscover(), pages([item('b', 0), item('a', 2)]));
  client.setQueryData(queryKeys.feedPost('a'), item('a', 2));

  patchFeedItem(client, 'a', withLikeToggled);

  expect(client.getQueryData<Pages>(queryKeys.feed())!.pages[0].data[0].like_count).toBe(3);
  const discover = client.getQueryData<Pages>(queryKeys.feedDiscover())!.pages[0].data;
  expect(discover[1].like_count).toBe(3);
  expect(discover[0].like_count).toBe(0);
  expect(client.getQueryData<FeedItem>(queryKeys.feedPost('a'))!.like_count).toBe(3);
});

it('finds a post that is only in Discover', () => {
  const client = new QueryClient();
  client.setQueryData(queryKeys.feedDiscover(), pages([item('d', 5)]));

  expect(findCachedFeedItem(client, 'd')?.like_count).toBe(5);
  expect(findCachedFeedItem(client, 'nowhere')).toBeUndefined();
});
