import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { followsService } from '../services/follows';

export function useIsFollowing(userId: string) {
  return useQuery({
    queryKey: ['follows', 'check', userId],
    queryFn: () => followsService.isFollowing(userId),
    enabled: !!userId,
  });
}

export function useToggleFollow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => followsService.toggle(userId),
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({ queryKey: ['follows'] });
      queryClient.invalidateQueries({ queryKey: ['publicProfile', userId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useFollowers(userId: string, page = 1) {
  return useQuery({
    queryKey: ['follows', 'followers', userId, page],
    queryFn: () => followsService.getFollowers(userId, page),
    enabled: !!userId,
  });
}

export function useFollowing(userId: string, page = 1) {
  return useQuery({
    queryKey: ['follows', 'following', userId, page],
    queryFn: () => followsService.getFollowing(userId, page),
    enabled: !!userId,
  });
}

export function useFollowCounts(userId: string) {
  return useQuery({
    queryKey: ['follows', 'counts', userId],
    queryFn: () => followsService.getCounts(userId),
    enabled: !!userId,
  });
}
