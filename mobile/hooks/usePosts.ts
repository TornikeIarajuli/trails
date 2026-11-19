import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postsService, PostInput } from '../services/posts';
import { queryKeys } from '../utils/queryKeys';
import { patchFeedItem, removeFeedItem } from './useFeed';

/** Writes a post; the Following feed (where your own posts show) loads again with it. */
export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PostInput) => postsService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feed() });
    },
  });
}

/** Changes your post: its new text, photos, trail and place show wherever it is cached. */
export function useUpdatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, input }: { postId: string; input: PostInput }) => postsService.update(postId, input),
    onSuccess: (updated, { postId }) => {
      // Likes, comments and saves stay as the feed counted them
      patchFeedItem(queryClient, postId, (item) => ({
        ...item,
        extra_text: updated.extra_text,
        photo_url: updated.photo_url,
        photo_urls: updated.photo_urls,
        trail_id: updated.trail_id,
        trail_name_en: updated.trail_name_en,
        trail_name_ka: updated.trail_name_ka,
        trail_cover_image_url: updated.trail_cover_image_url,
        place_name: updated.place_name ?? null,
      }));
    },
  });
}

/** Deletes your post: it leaves every list at once. */
export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => postsService.remove(postId),
    onSuccess: (_, postId) => removeFeedItem(queryClient, postId),
  });
}
