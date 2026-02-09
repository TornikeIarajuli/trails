import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { badgesService } from '../services/badges';

export function useAllBadges() {
  return useQuery({
    queryKey: ['badges', 'all'],
    queryFn: () => badgesService.getAllBadges(),
  });
}

export function useMyBadges() {
  return useQuery({
    queryKey: ['badges', 'me'],
    queryFn: () => badgesService.getMyBadges(),
  });
}

export function useCheckBadges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => badgesService.checkBadges(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges'] });
    },
  });
}
