import { useQuery } from '@tanstack/react-query';
import { weatherService } from '../services/weather';
import { queryKeys } from '../utils/queryKeys';

export function useWeather(lat: number | null, lng: number | null) {
  return useQuery({
    queryKey: queryKeys.weather(lat ?? 0, lng ?? 0),
    queryFn: () => weatherService.getCurrentWeather(lat!, lng!),
    enabled: lat != null && lng != null,
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });
}
