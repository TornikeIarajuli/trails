import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { likesService, ActivityLike } from '../services/likes';
import { useAuthStore } from '../store/authStore';
import { queryKeys } from '../utils/queryKeys';
import { showError } from '../utils/showError';
import {
  FeedPages,
  findFeedItem,
  hasLikeSummary,
  withLikeState,
  withLikeToggled,
} from '../utils/feedCache';
import { patchFeedItem } from './useFeed';

/**
 * The full like list of one activity. The feed already carries `like_count` /
 * `liked_by_me` per item, so pass `enabled: false` there — fetching this per
 * feed card is what used to trip the API rate limit.
 */
export function useLikes(activityId: string, enabled = true) {
  const userId = useAuthStore((s) => s.user?.id);

  const query = useQuery({
    queryKey: queryKeys.likes.activity(activityId),
    queryFn: () => likesService.getLikes(activityId),
    enabled: !!activityId && enabled,
  });

  const liked = userId ? (query.data ?? []).some((l) => l.user_id === userId) : false;
  const count = query.data?.length ?? 0;

  return { ...query, liked, count };
}

export function useToggleLike() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: (data: { activity_id: string; activity_type: string }) =>
      likesService.toggleLike(data),
    onMutate: async ({ activity_id }) => {
      const likesKey = queryKeys.likes.activity(activity_id);
      await queryClient.cancelQueries({ queryKey: likesKey });

      // Optimistic update of the feed item (current API)…
      const feedItem = findFeedItem(queryClient.getQueryData<FeedPages>(queryKeys.feed()), activity_id);
      const previousSummary =
        feedItem && hasLikeSummary(feedItem)
          ? { liked: feedItem.liked_by_me, count: feedItem.like_count }
          : undefined;
      patchFeedItem(queryClient, activity_id, withLikeToggled);

      // …and of the like list, when that is what the screen is showing (older API)
      const previousLikes = queryClient.getQueryData<ActivityLike[]>(likesKey);
      if (previousLikes && userId) {
        const mine = previousLikes.some((l) => l.user_id === userId);
        queryClient.setQueryData<ActivityLike[]>(
          likesKey,
          mine
            ? previousLikes.filter((l) => l.user_id !== userId)
            : [
                ...previousLikes,
                { id: `optimistic-${activity_id}`, user_id: userId, created_at: new Date().toISOString() },
              ],
        );
      }

      return { likesKey, previousLikes, previousSummary };
    },
    onError: (err, { activity_id }, context) => {
      const previousSummary = context?.previousSummary;
      if (previousSummary) {
        patchFeedItem(queryClient, activity_id, (item) =>
          withLikeState(item, previousSummary.liked, previousSummary.count),
        );
      }
      if (context?.previousLikes !== undefined) {
        queryClient.setQueryData(context.likesKey, context.previousLikes);
      }
      showError(err);
    },
    onSuccess: (result, { activity_id }) => {
      // The server's answer is authoritative (it also settles a double toggle)
      if (typeof result?.liked === 'boolean' && typeof result?.count === 'number') {
        patchFeedItem(queryClient, activity_id, (item) => withLikeState(item, result.liked, result.count));
      }
    },
    onSettled: (_data, _err, { activity_id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.likes.activity(activity_id) });
    },
  });
}
