import type { InfiniteData } from '@tanstack/react-query';
import type { PaginatedResponse } from '../types/api';
import type { FeedComment, FeedItem } from '../types/feed';

export type FeedPages = InfiniteData<PaginatedResponse<FeedItem>>;

/** True when the feed item carries its own like state (current API); false for an older backend. */
export function hasLikeSummary(
  item: FeedItem,
): item is FeedItem & { like_count: number; liked_by_me: boolean } {
  return typeof item.like_count === 'number' && typeof item.liked_by_me === 'boolean';
}

export function findFeedItem(feed: FeedPages | undefined, activityId: string): FeedItem | undefined {
  for (const page of feed?.pages ?? []) {
    const item = page.data.find((it) => it.activity_id === activityId);
    if (item) return item;
  }
  return undefined;
}

/** Returns the feed with `patch` applied to the item of that activity (other items keep their identity). */
export function mapFeedItem(
  feed: FeedPages | undefined,
  activityId: string,
  patch: (item: FeedItem) => FeedItem,
): FeedPages | undefined {
  if (!feed) return feed;
  return {
    ...feed,
    pages: feed.pages.map((page) => ({
      ...page,
      data: page.data.map((item) => (item.activity_id === activityId ? patch(item) : item)),
    })),
  };
}

/** What the item will look like once the server has toggled the like. */
export function withLikeToggled(item: FeedItem): FeedItem {
  if (!hasLikeSummary(item)) return item;
  const liked = !item.liked_by_me;
  return {
    ...item,
    liked_by_me: liked,
    like_count: Math.max(0, item.like_count + (liked ? 1 : -1)),
  };
}

export function withLikeState(item: FeedItem, liked: boolean, count: number): FeedItem {
  if (!hasLikeSummary(item)) return item;
  return { ...item, liked_by_me: liked, like_count: Math.max(0, count) };
}

export function withCommentCountDelta(item: FeedItem, delta: number): FeedItem {
  if (typeof item.comment_count !== 'number') return item;
  return { ...item, comment_count: Math.max(0, item.comment_count + delta) };
}

/** A comment just posted: counted, and shown under the post as its newest. */
export function withNewComment(item: FeedItem, comment: FeedComment): FeedItem {
  return { ...withCommentCountDelta(item, 1), latest_comment: comment };
}

/**
 * A comment just deleted: no longer counted, and gone from under the post when it was the one
 * shown there (the next refresh brings the one before it).
 */
export function withoutComment(item: FeedItem, commentId: string): FeedItem {
  const next = withCommentCountDelta(item, -1);
  return item.latest_comment?.id === commentId ? { ...next, latest_comment: null } : next;
}
