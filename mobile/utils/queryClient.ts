import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 min — don't refetch fresh data
      gcTime: 24 * 60 * 60 * 1000,    // 24h — keep cache alive for offline
      retry: 2,
    },
  },
});
