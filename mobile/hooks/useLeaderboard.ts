import { useQuery } from '@tanstack/react-query';
import { usersService } from '../services/users';

export function useLeaderboard(limit?: number) {
  return useQuery({
    queryKey: ['leaderboard', limit],
    queryFn: () => usersService.getLeaderboard(limit),
  });
}
