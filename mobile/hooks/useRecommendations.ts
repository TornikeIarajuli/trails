import { useQuery } from '@tanstack/react-query';
import { trailsService } from '../services/trails';
import { queryKeys } from '../utils/queryKeys';

export function useRecommendations() {
  return useQuery({
    queryKey: queryKeys.recommendations(),
    queryFn: () => trailsService.getRecommendations(),
    staleTime: 10 * 60 * 1000, // 10 min
  });
}
