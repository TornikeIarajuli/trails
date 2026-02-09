import { useInfiniteQuery } from '@tanstack/react-query';
import { feedService } from '../services/feed';

export function useFeed() {
  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam = 1 }) => feedService.getFeed(pageParam),
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
  });
}
