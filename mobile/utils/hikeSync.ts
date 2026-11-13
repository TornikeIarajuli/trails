import { Alert } from 'react-native';
import type { QueryClient } from '@tanstack/react-query';
import { completionsService } from '../services/completions';
import { useAuthStore } from '../store/authStore';
import { useHikeStore } from '../store/hikeStore';
import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import { getErrorMessage } from './showError';
import { classifySyncFailure, entriesToSync, retryDelayMs, shouldSync } from './syncQueue';
import { buildRecordHikePayload } from './track';

/**
 * Uploads hikes that were finished while the server could not be reached.
 * `utils/syncQueue.ts` holds the decisions; this module performs them.
 */

let online = true;
let running = false;
let requestedWhileRunning = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/** Everything a newly recorded completion changes on screen. */
export function invalidateAfterHikeRecorded(client: QueryClient): void {
  client.invalidateQueries({ queryKey: queryKeys.completions.root() });
  client.invalidateQueries({ queryKey: queryKeys.profile.root() });
  client.invalidateQueries({ queryKey: queryKeys.badges.root() });
  client.invalidateQueries({ queryKey: queryKeys.leaderboard(0).slice(0, 1) });
  client.invalidateQueries({ queryKey: queryKeys.feed() });
}

function currentConditions() {
  const auth = useAuthStore.getState();
  return {
    isOnline: online,
    isAuthenticated: auth.isAuthenticated,
    userId: auth.user?.id ?? null,
    queue: useHikeStore.getState().pendingCompletions,
  };
}

/**
 * One pass over the queue, oldest first. Resolves to the delay before the next
 * attempt, or null when nothing is left that a retry could fix.
 */
export async function uploadPendingHikes(): Promise<number | null> {
  const attempted = new Set<string>();
  let uploaded = 0;
  let retryIn: number | null = null;

  for (;;) {
    // Re-read every round: the user may sign out or lose the connection mid-pass
    const conditions = currentConditions();
    if (!shouldSync(conditions)) break;
    const entry = entriesToSync(conditions.queue, conditions.userId).find(
      (candidate) => !attempted.has(candidate.localId),
    );
    if (!entry) break;
    attempted.add(entry.localId);

    try {
      const completion = await completionsService.recordHike(buildRecordHikePayload(entry));
      useHikeStore.getState().resolvePendingCompletion(entry.localId, completion.id);
      uploaded += 1;
    } catch (error) {
      if (classifySyncFailure(error) === 'drop') {
        useHikeStore.getState().removePendingCompletion(entry.localId);
        Alert.alert(
          'Saved hike could not be uploaded',
          `The server did not accept a hike that was saved on this phone, so it has been removed.\n\n${getErrorMessage(error)}`,
        );
        continue;
      }
      useHikeStore.getState().notePendingAttempt(entry.localId);
      retryIn = retryDelayMs(entry.attempts + 1);
      // The connection or the server is in trouble; the rest would fail the same way
      break;
    }
  }

  if (uploaded > 0) invalidateAfterHikeRecorded(queryClient);
  return retryIn;
}

/**
 * Starts an upload pass unless one is already running. Safe to call on every
 * change that might allow a sync (sign-in, connectivity, foreground, new entry).
 */
export function requestHikeSync(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (running) {
    requestedWhileRunning = true;
    return;
  }

  running = true;
  void (async () => {
    try {
      for (;;) {
        requestedWhileRunning = false;
        const retryIn = await uploadPendingHikes();
        if (retryIn !== null) {
          retryTimer = setTimeout(requestHikeSync, retryIn);
          break;
        }
        if (!requestedWhileRunning) break;
      }
    } finally {
      running = false;
    }
  })();
}

export function setHikeSyncOnline(isOnline: boolean): void {
  online = isOnline;
}
