import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkinsService } from '../services/checkins';
import { finishCheckIn, setBackBy } from '../utils/checkInSync';
import { queryKeys } from '../utils/queryKeys';

/** The open "Back by" check-in and who would be alerted (from the server). */
export function useCheckIn(enabled = true) {
  return useQuery({
    queryKey: queryKeys.checkIn(),
    queryFn: () => checkinsService.get(),
    enabled,
    staleTime: 30 * 1000,
  });
}

/** Sets (or moves) the back-by time of the hike in progress. */
export function useSetBackBy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { trailId: string; backBy: Date; position?: { lat: number; lng: number } | null }) =>
      setBackBy(args.trailId, args.backBy, args.position),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.checkIn() }),
  });
}

/** "I'm back", or the hike ended. */
export function useFinishCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => finishCheckIn({ byHiker: true }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.checkIn() }),
  });
}
