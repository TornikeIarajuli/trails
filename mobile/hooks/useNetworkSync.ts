import { useEffect, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { useHikeStore } from '../store/hikeStore';
import { completionsService } from '../services/completions';

/**
 * Mounts globally in _layout.tsx.
 * When the device comes back online and there's a pendingSync,
 * automatically retries the failed hike completion.
 */
export function useNetworkSync() {
  const isOnline = useNetworkStatus() !== 'offline';
  const pendingSync = useHikeStore((s) => s.pendingSync);
  const setPendingSync = useHikeStore((s) => s.setPendingSync);
  const isSyncing = useRef(false);

  useEffect(() => {
    if (!isOnline || !pendingSync || isSyncing.current) return;

    isSyncing.current = true;

    completionsService
      .recordHike(pendingSync.trailId, pendingSync.elapsedSeconds)
      .then(() => {
        setPendingSync(null);
        console.log('[NetworkSync] Pending hike synced successfully');
      })
      .catch((err) => {
        console.warn('[NetworkSync] Sync failed, will retry on next reconnect:', err);
      })
      .finally(() => {
        isSyncing.current = false;
      });
  }, [isOnline, pendingSync]);
}
