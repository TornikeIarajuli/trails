import { create } from 'zustand';

interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

interface HikeState {
  isActive: boolean;
  trailId: string | null;
  startTime: number | null;
  elapsedSeconds: number;
  visitedCheckpointIds: string[];
  gpsPoints: GpsPoint[];
  startHike: (trailId: string) => void;
  endHike: () => void;
  tick: () => void;
  markCheckpointVisited: (checkpointId: string) => void;
  addGpsPoint: (lat: number, lng: number) => void;
}

export const useHikeStore = create<HikeState>((set, get) => ({
  isActive: false,
  trailId: null,
  startTime: null,
  elapsedSeconds: 0,
  visitedCheckpointIds: [],
  gpsPoints: [],

  startHike: (trailId) =>
    set({
      isActive: true,
      trailId,
      startTime: Date.now(),
      elapsedSeconds: 0,
      visitedCheckpointIds: [],
      gpsPoints: [],
    }),

  endHike: () =>
    set({
      isActive: false,
      trailId: null,
      startTime: null,
      elapsedSeconds: 0,
      visitedCheckpointIds: [],
      gpsPoints: [],
    }),

  tick: () => {
    const { startTime } = get();
    if (startTime) {
      set({ elapsedSeconds: Math.floor((Date.now() - startTime) / 1000) });
    }
  },

  markCheckpointVisited: (checkpointId) =>
    set((state) => ({
      visitedCheckpointIds: [...state.visitedCheckpointIds, checkpointId],
    })),

  addGpsPoint: (lat, lng) =>
    set((state) => {
      const point = { lat, lng, timestamp: Date.now() };
      // Keep only last 500 points (~40 min at 5s interval) to prevent memory leak
      const points = state.gpsPoints.length >= 500
        ? [...state.gpsPoints.slice(-499), point]
        : [...state.gpsPoints, point];
      return { gpsPoints: points };
    }),
}));
