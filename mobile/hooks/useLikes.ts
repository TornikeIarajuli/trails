import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsService } from '../services/comments';
import { useAuthStore } from '../store/authStore';
import { queryKeys } from '../utils/queryKeys';

export function useLikes(activityId: string) {
  const userId = useAuthStore((s) => s.user?.id);

  const query = useQuery({
    queryKey: queryKeys.likes.activity(activityId),
    queryFn: () => commentsService.getLikes(activityId),
    enabled: !!activityId,
  });

  const liked = userId ? (query.data ?? []).some((l) => l.user_id === userId) : false;
  const count = query.data?.length ?? 0;

  return { ...query, liked, count };
}

export function useToggleLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { activity_id: string; activity_type: string }) =>
      commentsService.toggleLike(data),
    onMutate: async (variables) => {
      const key = queryKeys.likes.activity(variables.activity_id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.likes.activity(variables.activity_id),
      });
    },
  });
}
