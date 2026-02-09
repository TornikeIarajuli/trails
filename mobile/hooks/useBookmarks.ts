import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookmarksService } from '../services/bookmarks';

export function useMyBookmarks(page = 1) {
  return useQuery({
    queryKey: ['bookmarks', 'me', page],
    queryFn: () => bookmarksService.getMyBookmarks(page),
  });
}

export function useIsBookmarked(trailId: string) {
  return useQuery({
    queryKey: ['bookmarks', 'check', trailId],
    queryFn: () => bookmarksService.isBookmarked(trailId),
    enabled: !!trailId,
  });
}

export function useToggleBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (trailId: string) => bookmarksService.toggle(trailId),
    onSuccess: (_data, trailId) => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['trail', trailId] });
    },
  });
}
