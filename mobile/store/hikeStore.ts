import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { haversineDistance } from '../utils/geo';
import {
  HIKE_STORAGE_VERSION,
  LastHike,
  PersistedHikeState,
  flushHikeStorage,
  hikeStorage,
  migrateHikeState,
} from '../utils/hikeStorage';
import {
  GpsPoint,
  MAX_TRACK_POINTS,
  computeElapsedSeconds,
  shouldRecordFix,
  thinTrack,
  toGpsPoint,
} from '../utils/track';
import { PendingCompletion } from '../types/completion';

export type { GpsPoint } from '../utils/track';
export type { LastHike } from '../utils/hikeStorage';
export type { PendingCompletion } from '../types/completion';

interface HikeState extends PersistedHikeState {
  /** Derived from the timing fields by `tick()`; never persisted. */
  elapsedSeconds: number;
  /** True once the saved state has been read back from storage. */
  _hydrated: boolean;
  /** `ownerId` is the signed-in user the hike belongs to. */
  startHike: (trailId: string, ownerId?: string | null) => void;
  /** Finishes the hike and keeps its track for export, tied to the completion (or queue entry) it produced. */
  endHike: (result?: { completionId?: string | null; localId?: string | null }) => void;
  /** Abandons the hike: its track is dropped and the last finished hike is left alone. */
  discardHike: () => void;
  pauseHike: () => void;
  resumeHike: () => void;
  tick: () => void;
  markCheckpointVisited: (checkpointId: string) => void;
  /** Returns whether the fix was added to the track. */
  addGpsPoint: (
    lat: number,
    lng: number,
    fix?: { timestamp?: number; accuracy?: number | null },
  ) => boolean;
  enqueueCompletion: (completion: PendingCompletion) => void;
  notePendingAttempt: (localId: string) => void;
  removePendingCompletion: (localId: string) => void;
  /** A queued completion reached the server: drop it and tie the saved track to its id. */
  resolvePendingCompletion: (localId: string, completionId: string) => void;
}

const IDLE_HIKE = {
  isActive: false,
  trailId: null,
  ownerId: null,
  startTime: null,
  elapsedSeconds: 0,
  isPaused: false,
  resumedAt: null,
  baseElapsedSeconds: 0,
  visitedCheckpointIds: [] as string[],
  gpsPoints: [] as GpsPoint[],
  distanceCoveredMeters: 0,
};

export const useHikeStore = create<HikeState>()(
  persist(
    (set, get) => ({
      ...IDLE_HIKE,
      lastHike: null,
      pendingCompletions: [],
      _hydrated: false,

      startHike: (trailId, ownerId) => {
        const now = Date.now();
        set({
          ...IDLE_HIKE,
          isActive: true,
          trailId,
          ownerId: ownerId ?? null,
          startTime: now,
          resumedAt: now,
        });
        void flushHikeStorage();
      },

      pauseHike: () => {
        const { resumedAt, baseElapsedSeconds } = get();
        const segment = resumedAt ? Math.floor((Date.now() - resumedAt) / 1000) : 0;
        set({
          isPaused: true,
          resumedAt: null,
          baseElapsedSeconds: baseElapsedSeconds + segment,
        });
        void flushHikeStorage();
      },

      resumeHike: () => {
        set({ isPaused: false, resumedAt: Date.now() });
        void flushHikeStorage();
      },

      endHike: (result) => {
        const { trailId, gpsPoints, lastHike } = get();
        const finished: LastHike | null = trailId
          ? {
              trailId,
              completionId: result?.completionId ?? null,
              localId: result?.localId ?? null,
              points: gpsPoints,
            }
          : lastHike;
        set({ ...IDLE_HIKE, lastHike: finished });
        void flushHikeStorage();
      },

      discardHike: () => {
        set({ ...IDLE_HIKE });
        void flushHikeStorage();
      },

      tick: () => {
        const state = get();
        if (state.isPaused || !state.resumedAt) return;
        const elapsedSeconds = computeElapsedSeconds(state);
        if (elapsedSeconds !== state.elapsedSeconds) set({ elapsedSeconds });
      },

      markCheckpointVisited: (checkpointId) => {
        if (get().visitedCheckpointIds.includes(checkpointId)) return;
        set((state) => ({
          visitedCheckpointIds: [...state.visitedCheckpointIds, checkpointId],
        }));
        void flushHikeStorage();
      },

      addGpsPoint: (lat, lng, fix) => {
        const state = get();
        if (!state.isActive || state.isPaused) return false;

        const candidate = {
          lat,
          lng,
          timestamp: fix?.timestamp ?? Date.now(),
          accuracy: fix?.accuracy,
        };
        const previous = state.gpsPoints[state.gpsPoints.length - 1];
        if (!shouldRecordFix(previous, candidate)) return false;

        const point = toGpsPoint(candidate);
        const addedMeters = previous
          ? haversineDistance(previous.lat, previous.lng, point.lat, point.lng)
          : 0;
        set({
          gpsPoints: [...thinTrack(state.gpsPoints, MAX_TRACK_POINTS), point],
          distanceCoveredMeters: state.distanceCoveredMeters + addedMeters,
        });
        return true;
      },

      enqueueCompletion: (completion) => {
        set((state) => ({ pendingCompletions: [...state.pendingCompletions, completion] }));
        void flushHikeStorage();
      },

      notePendingAttempt: (localId) => {
        set((state) => ({
          pendingCompletions: state.pendingCompletions.map((entry) =>
            entry.localId === localId ? { ...entry, attempts: entry.attempts + 1 } : entry,
          ),
        }));
        void flushHikeStorage();
      },

      removePendingCompletion: (localId) => {
        set((state) => ({
          pendingCompletions: state.pendingCompletions.filter((entry) => entry.localId !== localId),
        }));
        void flushHikeStorage();
      },

      resolvePendingCompletion: (localId, completionId) => {
        set((state) => ({
          pendingCompletions: state.pendingCompletions.filter((entry) => entry.localId !== localId),
          lastHike:
            state.lastHike && state.lastHike.localId === localId
              ? { ...state.lastHike, completionId }
              : state.lastHike,
        }));
        void flushHikeStorage();
      },
    }),
    {
      name: 'hike-store',
      version: HIKE_STORAGE_VERSION,
      storage: hikeStorage,
      migrate: migrateHikeState,
      partialize: (state): PersistedHikeState => ({
        isActive: state.isActive,
        trailId: state.trailId,
        ownerId: state.ownerId,
        startTime: state.startTime,
        isPaused: state.isPaused,
        resumedAt: state.resumedAt,
        baseElapsedSeconds: state.baseElapsedSeconds,
        visitedCheckpointIds: state.visitedCheckpointIds,
        distanceCoveredMeters: state.distanceCoveredMeters,
        gpsPoints: state.gpsPoints,
        lastHike: state.lastHike,
        pendingCompletions: state.pendingCompletions,
      }),
      merge: (persisted, current) => {
        const restored = { ...current, ...(persisted as Partial<PersistedHikeState> | undefined) };
        return { ...restored, elapsedSeconds: computeElapsedSeconds(restored) };
      },
      onRehydrateStorage: () => () => {
        useHikeStore.setState({ _hydrated: true });
      },
    },
  ),
);

/**
 * Resolves once the saved state has been loaded. Anything written to the store
 * before that would be overwritten by it, so code that can run at process start
 * (the background location task) waits for this first.
 */
export function whenHikeStoreHydrated(): Promise<void> {
  if (useHikeStore.getState()._hydrated) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useHikeStore.subscribe((state) => {
      if (state._hydrated) {
        unsubscribe();
        resolve();
      }
    });
  });
}
