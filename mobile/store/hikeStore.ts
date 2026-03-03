import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haversineDistance } from '../utils/geo';

export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface PendingSync {
  trailId: string;
  elapsedSeconds: number;
  completedAt: string;
}

interface HikeState {
  isActive: boolean;
  trailId: string | null;
  startTime: number | null;
  elapsedSeconds: number;
  isPaused: boolean;
  resumedAt: number | null;
  baseElapsedSeconds: number;
  visitedCheckpointIds: string[];
  gpsPoints: GpsPoint[];
  lastHikeGpsPoints: GpsPoint[];
  distanceCoveredMeters: number;
  pendingSync: PendingSync | null;
  startHike: (trailId: string) => void;
  endHike: () => void;
  pauseHike: () => void;
  resumeHike: () => void;
  tick: () => void;
  markCheckpointVisited: (checkpointId: string) => void;
  addGpsPoint: (lat: number, lng: number) => void;
  clearLastHikeGps: () => void;
  setPendingSync: (sync: PendingSync | null) => void;
}

export const useHikeStore = create<HikeState>()(
  persist(
    (set, get) => ({
      isActive: false,
      trailId: null,
      startTime: null,
      elapsedSeconds: 0,
      isPaused: false,
      resumedAt: null,
      baseElapsedSeconds: 0,
      visitedCheckpointIds: [],
      gpsPoints: [],
      lastHikeGpsPoints: [],
      distanceCoveredMeters: 0,
      pendingSync: null,

      startHike: (trailId) =>
        set({
          isActive: true,
          trailId,
          startTime: Date.now(),
          elapsedSeconds: 0,
          isPaused: false,
          resumedAt: Date.now(),
          baseElapsedSeconds: 0,
          visitedCheckpointIds: [],
          gpsPoints: [],
          distanceCoveredMeters: 0,
        }),

      pauseHike: () => {
        const { resumedAt, baseElapsedSeconds } = get();
        const segment = resumedAt ? Math.floor((Date.now() - resumedAt) / 1000) : 0;
        set({
          isPaused: true,
          resumedAt: null,
          baseElapsedSeconds: baseElapsedSeconds + segment,
        });
      },

      resumeHike: () =>
        set({
          isPaused: false,
          resumedAt: Date.now(),
        }),

      endHike: () => {
        const { gpsPoints } = get();
        set({
          isActive: false,
          trailId: null,
          startTime: null,
          elapsedSeconds: 0,
          isPaused: false,
          resumedAt: null,
          baseElapsedSeconds: 0,
          visitedCheckpointIds: [],
          gpsPoints: [],
          lastHikeGpsPoints: gpsPoints, // preserve for GPX export
        });
      },

      tick: () => {
        const { isPaused, resumedAt, baseElapsedSeconds } = get();
        if (!isPaused && resumedAt) {
          set({ elapsedSeconds: baseElapsedSeconds + Math.floor((Date.now() - resumedAt) / 1000) });
        }
      },

      markCheckpointVisited: (checkpointId) =>
        set((state) => ({
          visitedCheckpointIds: [...state.visitedCheckpointIds, checkpointId],
        })),

      addGpsPoint: (lat, lng) => {
        const { isPaused } = get();
        if (isPaused) return;
        set((state) => {
          const point = { lat, lng, timestamp: Date.now() };
          // Keep only last 500 points (~40 min at 5s interval) to prevent memory leak
          const points = state.gpsPoints.length >= 500
            ? [...state.gpsPoints.slice(-499), point]
            : [...state.gpsPoints, point];
          // Accumulate distance from last point
          const lastPoint = state.gpsPoints[state.gpsPoints.length - 1];
          const addedMeters = lastPoint
            ? haversineDistance(lastPoint.lat, lastPoint.lng, lat, lng)
            : 0;
          return {
            gpsPoints: points,
            distanceCoveredMeters: state.distanceCoveredMeters + addedMeters,
          };
        });
      },

      clearLastHikeGps: () => set({ lastHikeGpsPoints: [] }),

      setPendingSync: (sync) => set({ pendingSync: sync }),
    }),
    {
      name: 'hike-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isActive: state.isActive,
        trailId: state.trailId,
        startTime: state.startTime,
        elapsedSeconds: state.elapsedSeconds,
        isPaused: state.isPaused,
        resumedAt: state.resumedAt,
        baseElapsedSeconds: state.baseElapsedSeconds,
        visitedCheckpointIds: state.visitedCheckpointIds,
        gpsPoints: state.gpsPoints,
        lastHikeGpsPoints: state.lastHikeGpsPoints,
        distanceCoveredMeters: state.distanceCoveredMeters,
        pendingSync: state.pendingSync,
      }),
    },
  ),
);
