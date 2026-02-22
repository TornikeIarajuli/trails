import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookmarksService } from '../services/bookmarks';
import { queryKeys } from '../utils/queryKeys';

export function useMyBookmarks(page = 1) {
  return useQuery({
    queryKey: queryKeys.bookmarks.mine(page),
    queryFn: () => bookmarksService.getMyBookmarks(page),
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
    mutationFn: (trailId: string) => bookmarksService.toggle(trailId),
    onSuccess: (_data, trailId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.root() });
      queryClient.invalidateQueries({ queryKey: queryKeys.trail.detail(trailId) });
    },
  });
}
