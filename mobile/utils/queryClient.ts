import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

const MAX_QUERY_RETRIES = 2;

/**
 * Query-level retry policy. The API client already retries transient failures
 * itself, so retrying a 4xx here (404, 403, 429…) only multiplies requests, and
 * retrying while the device is offline only delays the error state.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false;
  if (!onlineManager.isOnline()) return false;
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) return false;
  return true;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 min — don't refetch fresh data
      gcTime: 24 * 60 * 60 * 1000,    // 24h — keep cache alive for offline
      retry: shouldRetryQuery,
      // 'always': requests are attempted (and fail visibly) even when the OS reports
      // no connection, instead of being paused. Stale queries are still refetched
      // when the connection or the app comes back.
      networkMode: 'always',
      refetchOnReconnect: true,
    },
    mutations: {
      // Never queue writes while offline — callers rely on the failure (e.g. hike sync).
      networkMode: 'always',
    },
  },
});

// React Native has no window focus/online events, so feed the managers by hand.
function wireAppLifecycle() {
  try {
    // Required here, inside the try: without the native module the import itself throws
    const netInfoModule = require('@react-native-community/netinfo');
    const NetInfo: typeof import('@react-native-community/netinfo').default =
      netInfoModule.default ?? netInfoModule;
    onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
    );
  } catch {
    // Without NetInfo the manager keeps its default (always online).
  }

  AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
}

wireAppLifecycle();
