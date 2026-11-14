import { useInfiniteQuery, useQuery, QueryClient } from '@tanstack/react-query';
import { feedService } from '../services/feed';
import { FeedItem } from '../types/feed';
import { FeedPages, findFeedItem, mapFeedItem } from '../utils/feedCache';
import { queryKeys } from '../utils/queryKeys';

export function useFeed() {
  return useInfiniteQuery({
    queryKey: queryKeys.feed(),
    queryFn: ({ pageParam = 1 }) => feedService.getFeed(pageParam),
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000, // 2 min — social feed should feel reasonably fresh
  });
}

/** One post, for the screen a like or comment notification opens. */
export function useFeedPost(activityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.feedPost(activityId ?? ''),
    queryFn: () => feedService.getPost(activityId as string),
    enabled: !!activityId,
    staleTime: 30 * 1000,
  });
}

/**
 * Updates one activity wherever it is cached (the feed, and its own post screen) in place,
 * without refetching every loaded page.
 */
export function patchFeedItem(
  queryClient: QueryClient,
  activityId: string,
  patch: (item: FeedItem) => FeedItem,
) {
  queryClient.setQueryData<FeedPages>(queryKeys.feed(), (old) => mapFeedItem(old, activityId, patch));
  queryClient.setQueryData<FeedItem>(queryKeys.feedPost(activityId), (old) => (old ? patch(old) : old));
}

/** The cached copy of an activity: from the feed, or else from its post screen. */
export function findCachedFeedItem(queryClient: QueryClient, activityId: string): FeedItem | undefined {
  return (
    findFeedItem(queryClient.getQueryData<FeedPages>(queryKeys.feed()), activityId) ??
    queryClient.getQueryData<FeedItem>(queryKeys.feedPost(activityId))
  );
}
