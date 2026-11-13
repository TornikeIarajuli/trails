import { useInfiniteQuery, QueryClient } from '@tanstack/react-query';
import { feedService } from '../services/feed';
import { FeedItem } from '../types/feed';
import { FeedPages, mapFeedItem } from '../utils/feedCache';
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

/** Updates one activity in the cached feed in place, without refetching every loaded page. */
export function patchFeedItem(
  queryClient: QueryClient,
  activityId: string,
  patch: (item: FeedItem) => FeedItem,
) {
  queryClient.setQueryData<FeedPages>(queryKeys.feed(), (old) => mapFeedItem(old, activityId, patch));
}
