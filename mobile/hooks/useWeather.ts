import { useQuery } from '@tanstack/react-query';
import { weatherService } from '../services/weather';

export function useWeather(lat: number | null, lng: number | null) {
  return useQuery({
    queryKey: ['weather', lat, lng],
    queryFn: () => weatherService.getCurrentWeather(lat!, lng!),
    enabled: lat != null && lng != null,
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });
}
