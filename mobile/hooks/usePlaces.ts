import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { PlaceFilter, PlaceKind, placesService } from '../services/places';
import { getErrorStatus } from '../utils/showError';
import { queryKeys } from '../utils/queryKeys';

const PAGE = 50;

/** The server only searches around points in and near Georgia. */
export function nearGeorgia(p: { latitude: number; longitude: number } | null): boolean {
  return !!p && p.latitude >= 40 && p.latitude <= 44.5 && p.longitude >= 39.5 && p.longitude <= 47;
}

/** Places by kind, region or name, a page at a time (most notable first). */
export function usePlaces(filter: { kind?: PlaceKind; region?: string; q?: string }) {
  const key = `${filter.kind ?? 'all'}|${filter.region ?? ''}|${filter.q ?? ''}`;
  return useInfiniteQuery({
    queryKey: queryKeys.places.list(key),
    queryFn: ({ pageParam }) => placesService.list({ ...filter, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.data.length, 0);
      return last.data.length === PAGE && loaded < last.total ? loaded : undefined;
    },
    staleTime: 30 * 60 * 1000,
  });
}

/** Places around a point, nearest first. */
export function useNearbyPlaces(
  near: { latitude: number; longitude: number } | null,
  options: { radiusKm?: number; limit?: number; kind?: PlaceKind } = {},
) {
  const filter: PlaceFilter = { near: near ?? undefined, radiusKm: options.radiusKm ?? 25, limit: options.limit ?? 8, kind: options.kind };
  const key = near
    ? `near|${near.latitude.toFixed(3)},${near.longitude.toFixed(3)}|${filter.radiusKm}|${filter.limit}|${options.kind ?? ''}`
    : 'near|none';
  return useQuery({
    queryKey: queryKeys.places.list(key),
    queryFn: () => placesService.list(filter),
    enabled: nearGeorgia(near),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
}

/** A region's places, most notable first, for its day routes. */
export function useRegionPlaces(region: string | undefined) {
  return useQuery({
    queryKey: queryKeys.places.region(region ?? ''),
    queryFn: () => placesService.list({ region, limit: 200 }),
    enabled: !!region,
    staleTime: 60 * 60 * 1000,
  });
}

export function usePlace(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.places.detail(id ?? ''),
    queryFn: () => placesService.get(id as string),
    enabled: !!id,
    staleTime: 30 * 60 * 1000,
    retry: (count, err) => getErrorStatus(err) !== 404 && count < 1,
  });
}
