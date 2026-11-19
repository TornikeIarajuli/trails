import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { forecastService } from '../services/forecast';
import { forecastPoint } from '../utils/trailVerdict';
import { parseGeoLineString, parseGeoPoint } from '../utils/geo';
import { queryKeys } from '../utils/queryKeys';
import type { TrailDetail } from '../types/trail';

/**
 * The 7-day forecast at the trail's highest point. `ready` waits for the full trail (route and
 * elevation profile), so the list's placeholder does not fetch a forecast for the start first.
 */
export function useTrailForecast(trail: TrailDetail | undefined, ready = true) {
  const route = trail?.route;
  const profile = trail?.elevation_profile;
  const start = trail?.start_point;
  const point = useMemo(
    () => (trail ? forecastPoint(parseGeoLineString(route), profile, parseGeoPoint(start)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route, profile, start],
  );

  const query = useQuery({
    queryKey: queryKeys.trailForecast(trail?.id ?? '', point?.latitude ?? 0, point?.longitude ?? 0, point?.elevationM ?? null),
    queryFn: () => forecastService.getMountainForecast(point!),
    enabled: ready && !!trail && !!point,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  return { ...query, point };
}
