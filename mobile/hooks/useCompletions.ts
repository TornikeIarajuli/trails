import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { completionsService } from '../services/completions';

export function useMyCompletions() {
  return useQuery({
    queryKey: ['completions', 'me'],
    queryFn: () => completionsService.getMyCompletions(),
  });
}

export function useTrailCompletions(trailId: string) {
  return useQuery({
    queryKey: ['completions', 'trail', trailId],
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
      queryClient.invalidateQueries({ queryKey: ['completions'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
