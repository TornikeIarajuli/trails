import { useMemo } from 'react';
import { useWeather } from './useWeather';
import { parseGeoPoint } from '../utils/geo';
import { buildGearPlan, pickForecast, GearForecast, GearPlan } from '../utils/gear';
import type { TrailDetail } from '../types/trail';

/** The trail's "What to bring" list, using the same trailhead forecast as the weather card. */
export function useGearPlan(
  trail: TrailDetail | undefined,
): { plan: GearPlan; forecast: GearForecast | null } | null {
  const start = trail ? parseGeoPoint(trail.start_point) : null;
  const { data: weather } = useWeather(start?.latitude ?? null, start?.longitude ?? null);

  return useMemo(() => {
    if (!trail) return null;
    const forecast = pickForecast(weather);
    return { plan: buildGearPlan(trail, { month: new Date().getMonth() + 1, forecast }), forecast };
  }, [trail, weather]);
}
