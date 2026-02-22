import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { badgesService } from '../services/badges';
import { queryKeys } from '../utils/queryKeys';

export function useAllBadges() {
  return useQuery({
    queryKey: queryKeys.badges.all(),
    queryFn: () => badgesService.getAllBadges(),
  });
}

export function useMyBadges() {
  return useQuery({
    queryKey: queryKeys.badges.mine(),
    queryFn: () => badgesService.getMyBadges(),
  });
}

export function useBadgeProgress() {
  return useQuery({
    queryKey: queryKeys.badges.progress(),
    queryFn: () => badgesService.getProgress(),
  });
}

export function useCheckBadges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => badgesService.checkBadges(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.badges.root() });
    },
  });
}
