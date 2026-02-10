import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { trailsService, TrailFilterParams } from '../services/trails';
import { trailCache } from '../utils/trailCache';
import { TrailDetail } from '../types/trail';

export function useTrails(params?: TrailFilterParams) {
  return useInfiniteQuery({
    queryKey: ['trails', params],
    queryFn: ({ pageParam = 1 }) =>
      trailsService.getTrails({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
  });
}

export function useTrail(id: string) {
  return useQuery({
    queryKey: ['trail', id],
    queryFn: async () => {
      const data = await trailsService.getTrail(id);
      // Cache trail for offline access
      trailCache.setTrailDetail(id, data);
      return data;
    },
    enabled: !!id,
    placeholderData: () => trailCache.getTrailDetail<TrailDetail>(id) ?? undefined,
  });
}

export function useRegions() {
  return useQuery({
    queryKey: ['regions'],
    queryFn: () => trailsService.getRegions(),
  });
}

export function useNearbyTrails(lat?: number, lng?: number, radiusKm?: number) {
  return useQuery({
    queryKey: ['nearbyTrails', lat, lng, radiusKm],
    queryFn: () => trailsService.getNearby(lat!, lng!, radiusKm),
    enabled: lat !== undefined && lng !== undefined,
  });
}
