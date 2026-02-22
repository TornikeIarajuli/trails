import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { completionsService } from '../services/completions';
import { showError } from '../utils/showError';
import { queryKeys } from '../utils/queryKeys';

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

  return useMutation({
    mutationFn: (data: { trailId: string; elapsedSeconds?: number }) =>
      completionsService.recordHike(data.trailId, data.elapsedSeconds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.completions.root() });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.root() });
    },
    onError: (err) => showError(err),
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
