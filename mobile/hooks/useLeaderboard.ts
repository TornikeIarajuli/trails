import { useQuery } from '@tanstack/react-query';
import { usersService } from '../services/users';
import { queryKeys } from '../utils/queryKeys';

export function useLeaderboard(limit?: number) {
  return useQuery({
    queryKey: queryKeys.leaderboard(limit ?? 50),
    queryFn: () => usersService.getLeaderboard(limit),
  });
}
