import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewsService } from '../services/reviews';
import { showError } from '../utils/showError';
import { queryKeys } from '../utils/queryKeys';

export function useTrailReviews(trailId: string) {
  return useQuery({
    queryKey: queryKeys.reviews.trail(trailId),
    queryFn: () => reviewsService.getTrailReviews(trailId),
    enabled: !!trailId,
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      trail_id: string;
      rating: number;
      comment?: string;
    }) => reviewsService.submitReview(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.trail(variables.trail_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trail.detail(variables.trail_id) });
    },
    onError: (err) => showError(err),
  });
}

export function useUpdateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      id: string;
      trail_id: string;
      rating: number;
      comment?: string;
    }) => reviewsService.updateReview(data.id, {
      rating: data.rating,
      comment: data.comment,
    }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.trail(variables.trail_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trail.detail(variables.trail_id) });
    },
    onError: (err) => showError(err),
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: string; trail_id: string }) =>
      reviewsService.deleteReview(data.id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.trail(variables.trail_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trail.detail(variables.trail_id) });
    },
    onError: (err) => showError(err),
  });
}
