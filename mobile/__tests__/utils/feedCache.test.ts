import {
  FeedPages,
  findFeedItem,
  hasLikeSummary,
  mapFeedItem,
  withCommentCountDelta,
  withLikeState,
  withLikeToggled,
} from '../../utils/feedCache';
import type { FeedItem } from '../../types/feed';

const item = (activity_id: string, extra: Partial<FeedItem> = {}): FeedItem => ({
  activity_id,
  activity_type: 'completion',
  user_id: 'u1',
  trail_id: 't1',
  created_at: '2026-11-13T10:00:00Z',
  extra_text: null,
  photo_url: null,
  photo_urls: null,
  user_username: 'nino',
  user_full_name: null,
  user_avatar_url: null,
  trail_name_en: 'Gergeti',
  trail_name_ka: null,
  trail_cover_image_url: null,
  ...extra,
});

const feed = (items: FeedItem[]): FeedPages => ({
  pages: [{ data: items, pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 } }],
  pageParams: [1],
});

describe('hasLikeSummary', () => {
  it('is true only when the API sent like_count and liked_by_me', () => {
    expect(hasLikeSummary(item('a', { like_count: 0, liked_by_me: false }))).toBe(true);
    expect(hasLikeSummary(item('a'))).toBe(false);
    expect(hasLikeSummary(item('a', { like_count: 3 }))).toBe(false);
  });
});

describe('withLikeToggled / withLikeState', () => {
  it('likes and unlikes optimistically', () => {
    const liked = withLikeToggled(item('a', { like_count: 2, liked_by_me: false }));
    expect(liked).toMatchObject({ like_count: 3, liked_by_me: true });
    expect(withLikeToggled(liked)).toMatchObject({ like_count: 2, liked_by_me: false });
  });

  it('never goes below zero', () => {
    expect(withLikeToggled(item('a', { like_count: 0, liked_by_me: true }))).toMatchObject({ like_count: 0 });
  });

  it('leaves items from an older API untouched', () => {
    const old = item('a');
    expect(withLikeToggled(old)).toBe(old);
    expect(withLikeState(old, true, 4)).toBe(old);
  });

  it('applies the server state', () => {
    expect(withLikeState(item('a', { like_count: 9, liked_by_me: false }), true, 5)).toMatchObject({
      like_count: 5,
      liked_by_me: true,
    });
  });
});

describe('withCommentCountDelta', () => {
  it('adjusts a known count and ignores a missing one', () => {
    expect(withCommentCountDelta(item('a', { comment_count: 1 }), 1).comment_count).toBe(2);
    expect(withCommentCountDelta(item('a', { comment_count: 0 }), -1).comment_count).toBe(0);
    expect(withCommentCountDelta(item('a'), 1).comment_count).toBeUndefined();
  });
});

describe('findFeedItem / mapFeedItem', () => {
  it('patches only the matching activity and keeps the others as they are', () => {
    const a = item('a', { like_count: 1, liked_by_me: false });
    const b = item('b');
    const before = feed([a, b]);
    const after = mapFeedItem(before, 'a', withLikeToggled)!;

    expect(findFeedItem(after, 'a')).toMatchObject({ like_count: 2, liked_by_me: true });
    expect(after.pages[0].data[1]).toBe(b);
    expect(findFeedItem(before, 'a')).toBe(a);
  });

  it('copes with an empty cache', () => {
    expect(mapFeedItem(undefined, 'a', withLikeToggled)).toBeUndefined();
    expect(findFeedItem(undefined, 'a')).toBeUndefined();
  });
});
