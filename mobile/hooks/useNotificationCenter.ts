import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { notificationsService } from '../services/notifications';
import { useAuthStore } from '../store/authStore';
import { queryKeys } from '../utils/queryKeys';

/** The notification history, loaded page by page. */
export function useNotificationFeed() {
  return useInfiniteQuery({
    queryKey: queryKeys.notifications.feed(),
    queryFn: ({ pageParam = 1 }) => notificationsService.getNotifications(pageParam),
    initialPageParam: 1,
    // The endpoint reports only the grand total, so derive "is there more" from what is loaded
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + (page.data?.length ?? 0), 0);
      const hasMore = (lastPage.data?.length ?? 0) > 0 && loaded < (lastPage.total ?? 0);
      return hasMore ? allPages.length + 1 : undefined;
    },
    staleTime: 30 * 1000, // notifications should feel near-real-time
  });
}

/** Unread count for the bell in the tabs header. */
export function useUnreadNotificationCount(): number {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data } = useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: async () => {
      const page = await notificationsService.getNotifications(1);
      return typeof page.unreadCount === 'number' ? page.unreadCount : 0;
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  return isAuthenticated ? data ?? 0 : 0;
}
