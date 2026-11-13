import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { followsService } from '../services/follows';
import { showError } from '../utils/showError';
import { queryKeys } from '../utils/queryKeys';

export function useIsFollowing(userId: string) {
  return useQuery({
    queryKey: queryKeys.follows.check(userId),
    queryFn: () => followsService.isFollowing(userId),
    enabled: !!userId,
  });
}

export function useToggleFollow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => followsService.toggle(userId),
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.follows.root() });
      queryClient.invalidateQueries({ queryKey: queryKeys.follows.publicProfile(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed() });
    },
    onError: (err) => showError(err),
  });
}

/** A user's followers or the users they follow, loaded page by page. */
export function useFollowList(kind: 'followers' | 'following', userId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.follows.list(kind, userId),
    queryFn: ({ pageParam = 1 }) =>
      kind === 'followers'
        ? followsService.getFollowers(userId, pageParam)
        : followsService.getFollowing(userId, pageParam),
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: !!userId,
  });
}

export function useFollowCounts(userId: string) {
  return useQuery({
    queryKey: queryKeys.follows.counts(userId),
    queryFn: () => followsService.getCounts(userId),
    enabled: !!userId,
  });
}
