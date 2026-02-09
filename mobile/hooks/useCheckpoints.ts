import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { checkpointsService } from '../services/checkpoints';

export function useTrailCheckpoints(trailId: string) {
  return useQuery({
    queryKey: ['checkpoints', trailId],
    queryFn: () => checkpointsService.getByTrail(trailId),
    enabled: !!trailId,
  });
}

export function useMyCheckpointCompletions(trailId?: string) {
  return useQuery({
    queryKey: ['checkpointCompletions', 'me', trailId],
    queryFn: () =>
      trailId
        ? checkpointsService.getMyTrailCompletions(trailId)
        : checkpointsService.getMyCompletions(),
  });
}

export function useSubmitCheckpointCompletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      checkpoint_id: string;
      proof_photo_url: string;
      photo_lat: number;
      photo_lng: number;
    }) => checkpointsService.submitCompletion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkpointCompletions'] });
    },
  });
}
