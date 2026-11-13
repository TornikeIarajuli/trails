import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { completionsService } from '../services/completions';
import { showError } from '../utils/showError';
import { queryKeys } from '../utils/queryKeys';
import { invalidateAfterHikeRecorded } from '../utils/hikeSync';
import { buildRecordHikePayload } from '../utils/track';
import { pastHikeToCompletion, upsertCompletion } from '../utils/pastHikes';
import { PendingCompletion, TrailCompletion } from '../types/completion';
import { TrailDetail } from '../types/trail';
import api from '../services/api';

export function useMyCompletions(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.completions.mine(),
    queryFn: () => completionsService.getMyCompletions(),
    enabled: options?.enabled ?? true,
  });
}

/** Everything that shows whether the user has done a trail (no trail list carries a done mark). */
function invalidateCompletionState(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.completions.root() });
  // Profile, its totals and the per-region progress of My Georgia
  queryClient.invalidateQueries({ queryKey: queryKeys.profile.root() });
  queryClient.invalidateQueries({ queryKey: queryKeys.badges.root() });
  queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard(0).slice(0, 1) });
  queryClient.invalidateQueries({ queryKey: queryKeys.recommendations() });
}

/**
 * Marks a trail as done for a hike from before the app. No onError: the year
 * picker shows the server's answer (for example a hike waiting for review).
 */
export function useLogPastHike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ trailId, year }: { trailId: string; year: number }) =>
      completionsService.logPastHike(trailId, year),
    onSuccess: (result, { trailId }) => {
      // A new completion is shown at once; an existing one is already in the list
      if (!result.already_existed) {
        const trail = queryClient.getQueryData<TrailDetail>(queryKeys.trail.detail(trailId));
        queryClient.setQueryData<TrailCompletion[]>(queryKeys.completions.mine(), (list) =>
          upsertCompletion(list, pastHikeToCompletion(result, trail)),
        );
      }
      invalidateCompletionState(queryClient);
    },
  });
}

export function useTrailCompletions(trailId: string) {
  return useQuery({
    queryKey: queryKeys.completions.trail(trailId),
    queryFn: () => completionsService.getTrailCompletions(trailId),
    enabled: !!trailId,
  });
}

export function useSubmitCompletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      trail_id: string;
      proof_photo_url: string;
      photo_lat: number;
      photo_lng: number;
    }) => completionsService.submit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.completions.root() });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.root() });
    },
    onError: (err) => showError(err),
  });
}

export function useRecordHike() {
  const queryClient = useQueryClient();

  // No onError here: the hike screen decides between queueing the hike for later
  // and showing the server's refusal, and a second generic alert would hide that.
  return useMutation({
    mutationFn: (completion: PendingCompletion) =>
      completionsService.recordHike(buildRecordHikePayload(completion)),
    onSuccess: () => invalidateAfterHikeRecorded(queryClient),
  });
}

export function useDeleteCompletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => completionsService.deleteCompletion(id),
    onSuccess: (_result, id) => {
      // Gone from the trail screen and the profile at once, not only after the refetch
      queryClient.setQueryData<TrailCompletion[]>(queryKeys.completions.mine(), (list) =>
        list?.filter((c) => c.id !== id),
      );
      invalidateCompletionState(queryClient);
    },
    onError: (err) => showError(err),
  });
}

export function useActiveHikerCount(trailId: string) {
  return useQuery({
    queryKey: queryKeys.activeHikes.count(trailId),
    queryFn: async () => {
      const { data } = await api.get<{ count: number }>(`/completions/active/${trailId}/count`);
      return data.count;
    },
    enabled: !!trailId,
    refetchInterval: 60_000,
  });
}
