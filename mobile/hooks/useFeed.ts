import { useInfiniteQuery, useQuery, QueryClient } from '@tanstack/react-query';
import { feedService } from '../services/feed';
import { usersService } from '../services/users';
import { FeedItem } from '../types/feed';
import { FeedPages, findFeedItem, mapFeedItem } from '../utils/feedCache';
import { queryKeys } from '../utils/queryKeys';

/** The lists of posts kept in the cache: Following, and Discover. */
const POST_LISTS = [queryKeys.feed(), queryKeys.feedDiscover()] as const;

const nextPage = (lastPage: { pagination: { page: number; totalPages: number } }) => {
  const { page, totalPages } = lastPage.pagination;
  return page < totalPages ? page + 1 : undefined;
};

export function useFeed() {
  return useInfiniteQuery({
    queryKey: queryKeys.feed(),
    queryFn: ({ pageParam = 1 }) => feedService.getFeed(pageParam),
    getNextPageParam: nextPage,
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000, // 2 min — social feed should feel reasonably fresh
  });
}

/** Discover: everyone's posts, best first. Loaded once the segment is opened. */
export function useDiscoverFeed(enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.feedDiscover(),
    queryFn: ({ pageParam = 1 }) => feedService.getDiscover(pageParam),
    getNextPageParam: nextPage,
    initialPageParam: 1,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Hikers to follow, shown at the top of Discover. */
export function useSuggestedHikers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.suggestedHikers(),
    queryFn: () => usersService.getSuggestedHikers(10),
    enabled,
    staleTime: 10 * 60 * 1000,
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
 * Updates one activity wherever it is cached (Following, Discover, and its own post screen)
 * in place, without refetching every loaded page.
 */
export function patchFeedItem(
  queryClient: QueryClient,
  activityId: string,
  patch: (item: FeedItem) => FeedItem,
) {
  for (const key of POST_LISTS) {
    queryClient.setQueryData<FeedPages>(key, (old) => mapFeedItem(old, activityId, patch));
  }
  queryClient.setQueryData<FeedItem>(queryKeys.feedPost(activityId), (old) => (old ? patch(old) : old));
}

/** The cached copy of an activity: from Following, Discover, or else its post screen. */
export function findCachedFeedItem(queryClient: QueryClient, activityId: string): FeedItem | undefined {
  for (const key of POST_LISTS) {
    const item = findFeedItem(queryClient.getQueryData<FeedPages>(key), activityId);
    if (item) return item;
  }
  return queryClient.getQueryData<FeedItem>(queryKeys.feedPost(activityId));
}
