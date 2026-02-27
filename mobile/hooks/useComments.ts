import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsService } from '../services/comments';
import { showError } from '../utils/showError';
import { queryKeys } from '../utils/queryKeys';

export function useComments(activityId: string) {
  return useQuery({
    queryKey: queryKeys.comments.activity(activityId),
    queryFn: () => commentsService.getComments(activityId),
    enabled: !!activityId,
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { activity_id: string; activity_type: string; comment: string }) =>
      commentsService.addComment(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.activity(variables.activity_id),
      });
    },
    onError: (err) => showError(err),
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: string; activity_id: string }) =>
      commentsService.deleteComment(data.id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.activity(variables.activity_id),
      });
    },
    onError: (err) => showError(err),
  });
}
