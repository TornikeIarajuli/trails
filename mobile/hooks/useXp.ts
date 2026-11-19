import { useQuery } from '@tanstack/react-query';
import { usersService } from '../services/users';
import { useAuthStore } from '../store/authStore';
import { queryKeys } from '../utils/queryKeys';
import type { XpPeriod } from '../types/user';

/** Hikers by XP this week, this month or all time (the server keeps it for a few minutes). */
export function useXpLeaderboard(period: XpPeriod, enabled = true) {
  return useQuery({
    queryKey: queryKeys.xpLeaderboard(period),
    queryFn: () => usersService.getXpLeaderboard(period, 50),
    enabled,
    staleTime: 3 * 60 * 1000,
  });
}

/** Your XP and ranks; only when signed in. */
export function useMyXp() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.myXp(),
    queryFn: () => usersService.getMyXp(),
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });
}

/** Someone's XP, for the level on their profile. */
export function useUserXp(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.userXp(userId ?? ''),
    queryFn: () => usersService.getUserXp(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}
