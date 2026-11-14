import { create } from 'zustand';
import {
  deleteAllOfflineMaps,
  readManifest,
  removeTrailTopo,
  saveTrailTopo,
} from '../services/offlineMaps';
import { TilePlan } from '../utils/topoTiles';
import { DownloadControl } from '../utils/tileDownloader';
import { TopoManifest } from '../utils/tileManifest';

export interface SavedTopoSummary {
  bytes: number;
  tiles: number;
}

export interface ActiveTopoDownload {
  trailId: string;
  done: number;
  total: number;
}

export type TopoDownloadResult = 'done' | 'cancelled' | 'failed' | 'busy';

interface OfflineMapsState {
  loaded: boolean;
  /** Trails whose topo map is saved on this phone. */
  saved: Record<string, SavedTopoSummary>;
  /** The download in progress; one at a time, to go easy on the tile server. */
  active: ActiveTopoDownload | null;
  /** The trail whose last download stopped before finishing. */
  failedTrailId: string | null;
  load: () => void;
  download: (trailId: string, name: string, plan: TilePlan) => Promise<TopoDownloadResult>;
  cancel: () => void;
  remove: (trailId: string) => void;
  deleteAll: () => void;
}

function summaries(manifest: TopoManifest): Record<string, SavedTopoSummary> {
  return Object.fromEntries(
    Object.entries(manifest.trails).map(([id, entry]) => [id, { bytes: entry.bytes, tiles: entry.tiles.length }]),
  );
}

let control: DownloadControl | null = null;

export const useOfflineMapsStore = create<OfflineMapsState>((set, get) => ({
  loaded: false,
  saved: {},
  active: null,
  failedTrailId: null,

  load: () => {
    if (get().loaded) return;
    set({ saved: summaries(readManifest()), loaded: true });
  },

  download: async (trailId, name, plan) => {
    if (get().active) return 'busy';
    if (plan.tiles.length === 0) return 'failed';
    const run: DownloadControl = { cancelled: false };
    control = run;
    set({ active: { trailId, done: 0, total: plan.tiles.length }, failedTrailId: null });
    try {
      const { outcome, saved } = await saveTrailTopo(trailId, name, plan, {
        control: run,
        onProgress: (done, total) => {
          if (get().active?.trailId === trailId) set({ active: { trailId, done, total } });
        },
      });
      set((state) => ({
        active: null,
        saved: saved ? { ...state.saved, [trailId]: { bytes: saved.bytes, tiles: saved.tiles.length } } : state.saved,
        failedTrailId: outcome.status === 'failed' ? trailId : null,
      }));
      return outcome.status;
    } catch {
      set({ active: null, failedTrailId: trailId });
      return 'failed';
    } finally {
      if (control === run) control = null;
    }
  },

  cancel: () => {
    if (control) control.cancelled = true;
  },

  remove: (trailId) => {
    try {
      set({ saved: summaries(removeTrailTopo(trailId)) });
    } catch {
      // The manifest could not be written; show what is on the phone now
      set({ saved: summaries(readManifest()) });
    }
  },

  deleteAll: () => {
    if (control) control.cancelled = true;
    deleteAllOfflineMaps();
    set({ saved: {}, failedTrailId: null });
  },
}));
