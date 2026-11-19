import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookingInput, GuideProfileInput, guidesService } from '../services/guides';
import { useAuthStore } from '../store/authStore';
import { getErrorStatus } from '../utils/showError';
import { queryKeys } from '../utils/queryKeys';

/** Verified guides, for a trail (listed on it or guiding in its region) or a region. */
export function useGuides(filter: { region?: string; trailId?: string } = {}, enabled = true) {
  const key = filter.trailId ? `trail:${filter.trailId}` : filter.region ? `region:${filter.region}` : 'all';
  return useQuery({
    queryKey: queryKeys.guides.list(key),
    queryFn: () => guidesService.list({ region: filter.region, trail_id: filter.trailId }),
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}

/** A guide's public profile; `data` stays undefined when they are not a verified guide. */
export function useGuide(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.guides.detail(userId ?? ''),
    queryFn: () => guidesService.get(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    // Not a guide (404) is an answer, not a failure to retry
    retry: (count, err) => getErrorStatus(err) !== 404 && count < 1,
  });
}

/** Your own guide profile (null when you never applied). */
export function useMyGuideProfile() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.guides.mine(),
    queryFn: () => guidesService.getMine(),
    enabled: isAuthenticated,
  });
}

export function useSaveGuideProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GuideProfileInput) => guidesService.saveMine(input),
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.guides.mine(), profile);
      queryClient.invalidateQueries({ queryKey: ['guides', 'list'] });
    },
  });
}

/** A guide's phone and messengers; only once they accepted one of your requests. */
export function useGuideContact(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.guides.contact(userId ?? ''),
    queryFn: () => guidesService.contact(userId as string),
    enabled: !!userId && enabled,
    retry: false,
  });
}

/** Your requests as a hiker, and the requests to you as a guide. */
export function useBookings() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.guides.bookings(),
    queryFn: () => guidesService.bookings(),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });
}

export function useRequestBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BookingInput) => guidesService.requestBooking(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.guides.bookings() }),
  });
}

export function useAnswerBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reply }: { id: string; status: 'accepted' | 'declined' | 'cancelled'; reply?: string }) =>
      guidesService.answerBooking(id, status, reply),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.guides.bookings() });
      queryClient.invalidateQueries({ queryKey: ['guides', 'contact'] });
    },
  });
}
