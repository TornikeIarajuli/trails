import { useInfiniteQuery } from '@tanstack/react-query';
import { feedService } from '../services/feed';
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
  });
}
