import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * What the hiker has ticked on each trail's "What to bring" list, kept on the device.
 * Packing is for one trip, so a list nobody touched for a while starts empty again.
 */

const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

export interface GearTicks {
  checked: string[];
  updatedAt: number;
}

interface GearState {
  ticks: Record<string, GearTicks>;
  /** Local date (YYYY-MM-DD) the list was last shown before starting a hike, per trail. */
  prehikeShownOn: Record<string, string>;
  toggle: (trailId: string, key: string) => void;
  setChecked: (trailId: string, key: string, checked: boolean) => void;
  clear: (trailId: string) => void;
  markPrehikeShown: (trailId: string, day: string) => void;
}

/** Drops lists nobody touched for two weeks, and pre-hike marks from other days. */
export function pruneGear(
  state: Pick<GearState, 'ticks' | 'prehikeShownOn'>,
  now: number,
  today: string,
): Pick<GearState, 'ticks' | 'prehikeShownOn'> {
  const ticks: Record<string, GearTicks> = {};
  for (const [id, t] of Object.entries(state.ticks ?? {})) {
    if (t && Array.isArray(t.checked) && now - (t.updatedAt ?? 0) < STALE_AFTER_MS) ticks[id] = t;
  }
  const prehikeShownOn: Record<string, string> = {};
  for (const [id, day] of Object.entries(state.prehikeShownOn ?? {})) {
    if (day === today) prehikeShownOn[id] = day;
  }
  return { ticks, prehikeShownOn };
}

export function localDay(date = new Date()): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Show the list once a day before a hike, and only while something essential is unticked. */
export function shouldShowPrehikeCheck(input: {
  essentials: string[];
  checked: string[];
  shownOn: string | undefined;
  today: string;
}): boolean {
  if (input.shownOn === input.today) return false;
  const checked = new Set(input.checked);
  return input.essentials.some((key) => !checked.has(key));
}

export const useGearStore = create<GearState>()(
  persist(
    (set) => ({
      ticks: {},
      prehikeShownOn: {},

      toggle: (trailId, key) =>
        set((state) => {
          const current = state.ticks[trailId]?.checked ?? [];
          const checked = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
          return { ticks: { ...state.ticks, [trailId]: { checked, updatedAt: Date.now() } } };
        }),

      setChecked: (trailId, key, value) =>
        set((state) => {
          const current = state.ticks[trailId]?.checked ?? [];
          if (current.includes(key) === value) return {};
          const checked = value ? [...current, key] : current.filter((k) => k !== key);
          return { ticks: { ...state.ticks, [trailId]: { checked, updatedAt: Date.now() } } };
        }),

      clear: (trailId) =>
        set((state) => {
          const { [trailId]: _removed, ...rest } = state.ticks;
          return { ticks: rest };
        }),

      markPrehikeShown: (trailId, day) =>
        set((state) => ({ prehikeShownOn: { ...state.prehikeShownOn, [trailId]: day } })),
    }),
    {
      name: 'gear_checklists',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ ticks: state.ticks, prehikeShownOn: state.prehikeShownOn }),
      merge: (persisted, current) => ({
        ...current,
        ...pruneGear((persisted ?? {}) as GearState, Date.now(), localDay()),
      }),
    },
  ),
);
