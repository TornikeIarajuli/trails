import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsService } from '../services/comments';
import { showError } from '../utils/showError';
import { queryKeys } from '../utils/queryKeys';
import { withCommentCountDelta } from '../utils/feedCache';
import { patchFeedItem } from './useFeed';

/** Pass `enabled: false` to hold the request back until the comments are actually shown. */
export function useComments(activityId: string, page = 1, limit = 50, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.comments.activity(activityId), page, limit],
    queryFn: () => commentsService.getComments(activityId, page, limit),
    enabled: !!activityId && enabled,
    select: (res) => res.data,
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
      patchFeedItem(queryClient, variables.activity_id, (item) => withCommentCountDelta(item, 1));
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
      patchFeedItem(queryClient, variables.activity_id, (item) => withCommentCountDelta(item, -1));
    },
    onError: (err) => showError(err),
  });
}
