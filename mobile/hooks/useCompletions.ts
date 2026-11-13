import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { completionsService } from '../services/completions';
import { showError } from '../utils/showError';
import { queryKeys } from '../utils/queryKeys';
import { invalidateAfterHikeRecorded } from '../utils/hikeSync';
import { buildRecordHikePayload } from '../utils/track';
import { PendingCompletion } from '../types/completion';
import api from '../services/api';

export function useMyCompletions() {
  return useQuery({
    queryKey: queryKeys.completions.mine(),
    queryFn: () => completionsService.getMyCompletions(),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.completions.root() });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.root() });
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
