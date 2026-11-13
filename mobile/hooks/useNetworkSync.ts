import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useNetworkStatus } from './useNetworkStatus';
import { useAuthStore } from '../store/authStore';
import { useHikeStore } from '../store/hikeStore';
import { requestHikeSync, setHikeSyncOnline } from '../utils/hikeSync';
import { entriesToSync } from '../utils/syncQueue';

/**
 * Mounts globally in _layout.tsx.
 * Uploads hikes that were finished without a connection as soon as the device
 * is online and their owner is signed in, and again whenever the app returns
 * to the foreground. Failed attempts back off on their own (see utils/hikeSync).
 */
export function useNetworkSync() {
  const isOnline = useNetworkStatus() !== 'offline';
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const pendingCount = useHikeStore((s) => entriesToSync(s.pendingCompletions, userId).length);

  useEffect(() => {
    setHikeSyncOnline(isOnline);
    requestHikeSync();
  }, [isOnline, isAuthenticated, userId, pendingCount]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestHikeSync();
    });
    return () => subscription.remove();
  }, []);
}
