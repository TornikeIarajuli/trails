import { useQuery } from '@tanstack/react-query';
import { regionsService } from '../services/regions';
import { useAuthStore } from '../store/authStore';
import { queryKeys } from '../utils/queryKeys';

/**
 * Completed trails per region — for the signed-in user, or for `userId`.
 * Refreshed automatically after a hike is recorded (the key lives under 'profile').
 */
export function useRegionProgress(userId?: string, enabled = true) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.profile.regions(userId),
    queryFn: () => regionsService.getRegionProgress(userId),
    // The signed-in user's own progress needs a session
    enabled: enabled && (!!userId || isAuthenticated),
    staleTime: 10 * 60 * 1000,
  });
}
