import { useQuery } from '@tanstack/react-query';
import { trailsService } from '../services/trails';
import type { Trail } from '../types/trail';
import type { TrailStats } from '../utils/feedPost';

/** Its own root, outside the trail lists kept for offline use: the feed only needs two numbers. */
export const FEED_TRAIL_STATS_KEY = ['feedTrailStats'] as const;

function toStatsMap(trails: Trail[]): Map<string, TrailStats> {
  return new Map(
    trails.map((t) => [t.id, { distance_km: t.distance_km, elevation_gain_m: t.elevation_gain_m }]),
  );
}

/**
 * Distance and ascent of every trail, for the stats under completions in the feed (feed items
 * do not carry them). One request for all trails, shared by every post and kept for a while.
 */
export function useFeedTrailStats(enabled = true) {
  return useQuery({
    queryKey: FEED_TRAIL_STATS_KEY,
    queryFn: async () => (await trailsService.getTrails({ limit: 500 })).data,
    select: toStatsMap,
    enabled,
    staleTime: 30 * 60 * 1000,
  });
}
