import type { QueryClient } from '@tanstack/react-query';
import type { TrailDetail } from '../types/trail';

type TrailLike = { id: string } & Partial<TrailDetail>;

/** Lists the detail screen can borrow a trail from (paged lists, plain arrays, { data }). */
const LIST_ROOTS = ['trails', 'nearbyTrails', 'recommendations'] as const;

function findTrail(data: unknown, id: string): TrailLike | undefined {
  if (!data) return undefined;
  if (Array.isArray(data)) {
    return data.find((t): t is TrailLike => !!t && typeof t === 'object' && (t as TrailLike).id === id);
  }
  if (typeof data === 'object') {
    const obj = data as { data?: unknown; pages?: unknown[] };
    if (Array.isArray(obj.pages)) {
      for (const page of obj.pages) {
        const found = findTrail(page, id);
        if (found) return found;
      }
    }
    if (obj.data !== undefined) return findTrail(obj.data, id);
  }
  return undefined;
}

/**
 * A stand-in for a trail's detail built from the same trail in a list the user just saw, so
 * the detail screen can show its photo, name and stats at once while the full trail loads.
 * Fields a list does not carry are empty; callers should treat the result as placeholder data
 * (TanStack Query's `isPlaceholderData`) and not draw "no reviews"/"no conditions" from it.
 */
export function trailDetailFromLists(queryClient: QueryClient, id: string): TrailDetail | undefined {
  for (const root of LIST_ROOTS) {
    for (const [, data] of queryClient.getQueriesData({ queryKey: [root] })) {
      const found = findTrail(data, id);
      if (found) {
        return {
          description_en: null,
          description_ka: null,
          name_ka: null,
          status: 'open',
          status_note: null,
          is_published: true,
          created_at: '',
          ...found,
          media: [],
          checkpoints: [],
          avg_rating: null,
          review_count: 0,
          start_point: found.start_point ?? null,
          end_point: null,
          route: null,
          conditions_count: 0,
          recent_conditions: [],
          photos_count: 0,
        } as TrailDetail;
      }
    }
  }
  return undefined;
}
