import {
  useQuery,
  useMutation,
  useQueryClient,
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

export function useFollowers(userId: string, page = 1) {
  return useQuery({
    queryKey: queryKeys.follows.followers(userId, page),
    queryFn: () => followsService.getFollowers(userId, page),
    enabled: !!userId,
  });
}

export function useFollowing(userId: string, page = 1) {
  return useQuery({
    queryKey: queryKeys.follows.following(userId, page),
    queryFn: () => followsService.getFollowing(userId, page),
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
