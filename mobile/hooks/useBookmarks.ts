import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { bookmarksService, BookmarkCategory } from '../services/bookmarks';
import { queryKeys } from '../utils/queryKeys';
import { showError } from '../utils/showError';

export function useMyBookmarks(page = 1, category?: BookmarkCategory) {
  return useQuery({
    queryKey: [...queryKeys.bookmarks.mine(page), category],
    queryFn: () => bookmarksService.getMyBookmarks(page, 20, category),
  });
}

/** All of the user's bookmarks (optionally one category), loaded page by page. */
export function useBookmarkList(category?: BookmarkCategory) {
  return useInfiniteQuery({
    queryKey: queryKeys.bookmarks.list(category),
    queryFn: ({ pageParam = 1 }) => bookmarksService.getMyBookmarks(pageParam, 20, category),
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
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
    onError: (err) => showError(err),
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
    onError: (err) => showError(err),
  });
}
