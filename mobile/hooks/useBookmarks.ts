import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookmarksService, BookmarkCategory } from '../services/bookmarks';
import { queryKeys } from '../utils/queryKeys';

export function useMyBookmarks(page = 1, category?: BookmarkCategory) {
  return useQuery({
    queryKey: [...queryKeys.bookmarks.mine(page), category],
    queryFn: () => bookmarksService.getMyBookmarks(page, 20, category),
  });
}

export function useIsBookmarked(trailId: string) {
  return useQuery({
    queryKey: queryKeys.bookmarks.check(trailId),
    queryFn: () => bookmarksService.isBookmarked(trailId),
    enabled: !!trailId,
  });
}

export function useToggleBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ trailId, category }: { trailId: string; category?: BookmarkCategory }) =>
      bookmarksService.toggle(trailId, category),
    onSuccess: (_data, { trailId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.root() });
      queryClient.invalidateQueries({ queryKey: queryKeys.trail.detail(trailId) });
    },
  });
}

export function useUpdateBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      trailId,
      data,
    }: {
      trailId: string;
      data: { category?: BookmarkCategory; note?: string | null };
    }) => bookmarksService.updateBookmark(trailId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.root() });
    },
  });
}
