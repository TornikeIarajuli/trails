import type { RegionProgress, RegionTotals } from '../types/regions';

const NONE_BACKGROUND = '#CFD8DC'; // neutral grey: nothing hiked yet
const COMPLETE_BACKGROUND = '#F9A825'; // gold: every trail in the region done
const GREEN_LIGHT = '#A5D6A7';
const GREEN_DARK = '#2E7D32';
const DARK_TEXT = '#263238';
const LIGHT_TEXT = '#FFFFFF';

export function progressRatio(completed: number, total: number): number {
  if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(1, Math.max(0, completed / total));
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(from: string, to: string, t: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`.toUpperCase();
}

/**
 * Colours for a region bubble or progress bar: grey when nothing is hiked, a
 * green that deepens with the share of trails done, gold when all are done.
 */
export function progressColors(completed: number, total: number): { background: string; text: string } {
  const ratio = progressRatio(completed, total);
  if (ratio <= 0) return { background: NONE_BACKGROUND, text: DARK_TEXT };
  if (ratio >= 1) return { background: COMPLETE_BACKGROUND, text: DARK_TEXT };
  return { background: mix(GREEN_LIGHT, GREEN_DARK, ratio), text: ratio >= 0.4 ? LIGHT_TEXT : DARK_TEXT };
}

/** "4 of 15 regions explored · 12 of 209 trails" */
export function regionsHeaderText(totals: RegionTotals | null | undefined): string {
  if (!totals) return '';
  return (
    `${totals.regions_started} of ${totals.regions_total} regions explored · ` +
    `${totals.trails_completed} of ${totals.trails_total} trails`
  );
}

/** "3/14" */
export function regionFraction(region: Pick<RegionProgress, 'completed' | 'total'>): string {
  return `${region.completed}/${region.total}`;
}

/** Regions with progress first (most complete first), then the rest by name. */
export function sortRegions(regions: RegionProgress[]): RegionProgress[] {
  return [...regions].sort((a, b) => {
    const byRatio = progressRatio(b.completed, b.total) - progressRatio(a.completed, a.total);
    if (byRatio !== 0) return byRatio;
    return a.region.localeCompare(b.region);
  });
}

const normaliseName = (name: string | null | undefined) => (name ?? '').trim().toLowerCase();

/**
 * Trails of exactly this region. The trail list filters regions by substring, so
 * a search for one region can also return its neighbours with longer names.
 */
export function filterTrailsToRegion<T extends { region: string | null | undefined }>(
  trails: T[],
  region: string,
): T[] {
  const wanted = normaliseName(region);
  return trails.filter((trail) => normaliseName(trail.region) === wanted);
}
