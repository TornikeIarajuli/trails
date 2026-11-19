import { useQuery } from '@tanstack/react-query';
import { ForecastPoint, forecastService } from '../services/forecast';
import { queryKeys } from '../utils/queryKeys';

/**
 * The 7-day forecast for any point: a place, or where you stand (`scope` keeps them apart).
 * Unlike a trail's forecast it is not kept on the phone: these are looked up, not hiked offline.
 */
export function useForecast(scope: string, point: ForecastPoint | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.forecastAt(scope, point?.latitude ?? 0, point?.longitude ?? 0, point?.elevationM ?? null),
    queryFn: () => forecastService.getMountainForecast(point!),
    enabled: enabled && !!point,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
}
