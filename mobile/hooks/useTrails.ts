import { useCallback } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { trailsService, TrailFilterParams } from '../services/trails';
import { trailCache } from '../utils/trailCache';
import { trailDetailFromLists } from '../utils/trailPlaceholder';
import { TrailDetail } from '../types/trail';
import { queryKeys } from '../utils/queryKeys';

async function fetchTrailDetail(id: string): Promise<TrailDetail> {
  const data = await trailsService.getTrail(id);
  // Cache trail for offline access
  trailCache.setTrailDetail(id, data);
  return data;
}

export function useTrails(params?: TrailFilterParams, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.trails(params),
    queryFn: ({ pageParam = 1 }) =>
      trailsService.getTrails({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
    enabled,
  });
}

export function useTrail(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.trail.detail(id),
    queryFn: () => fetchTrailDetail(id),
    enabled: !!id,
    // Seed from the offline copy as real (but stale) data rather than as placeholder:
    // placeholder data disappears when the fetch fails, which is exactly when the
    // offline copy is needed.
    initialData: () => trailCache.getTrailDetail<TrailDetail>(id) ?? undefined,
    initialDataUpdatedAt: 0,
    // Otherwise show the trail as it appeared in the list the user tapped (photo, name,
    // stats) while the full detail loads; check `isPlaceholderData` before drawing
    // sections the list does not carry.
    placeholderData: () => trailDetailFromLists(queryClient, id),
  });
}

/**
 * Starts loading a trail's detail when the user touches its card, so the screen usually
 * has it by the time the navigation animation ends.
 */
export function usePrefetchTrail() {
  const queryClient = useQueryClient();
  return useCallback(
    (id: string) => {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.trail.detail(id),
        queryFn: () => fetchTrailDetail(id),
        staleTime: 60_000,
      });
    },
    [queryClient],
  );
}

export function useRegions() {
  return useQuery({
    queryKey: queryKeys.regions(),
    queryFn: () => trailsService.getRegions(),
  });
}

export function useNearbyTrails(lat?: number, lng?: number, radiusKm?: number, version?: number) {
  return useQuery({
    queryKey: [...queryKeys.nearbyTrails(lat, lng, radiusKm), version],
    queryFn: () => trailsService.getNearby(lat!, lng!, radiusKm),
    enabled: lat !== undefined && lng !== undefined,
    staleTime: 0, // always re-fetch on new version
  });
}
