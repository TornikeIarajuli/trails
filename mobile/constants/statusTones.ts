/**
 * Colours for a trail's status banner (closed, seasonal, maintenance). On light themes: a pale
 * panel with a dark tone for the title. On dark themes: a faint tint of a light tone over the
 * screen, with that light tone for the title; the note uses the theme's textSecondary.
 */

export type TrailStatusTone = 'closed' | 'seasonal' | 'maintenance';

/** Hex alpha of the tint behind the banner on dark themes (about 14%). */
export const DARK_TINT_ALPHA = '24';

export const STATUS_TONES: Record<TrailStatusTone, { light: { background: string; color: string }; dark: string }> = {
  closed: { light: { background: '#FEF2F2', color: '#B91C1C' }, dark: '#FCA5A5' },
  seasonal: { light: { background: '#FFFBEB', color: '#B45309' }, dark: '#FCD34D' },
  maintenance: { light: { background: '#EFF6FF', color: '#1D4ED8' }, dark: '#93C5FD' },
};

/** Banner background and title/icon colour for a status, on a light or dark theme. */
export function statusTone(status: string, dark: boolean): { backgroundColor: string; color: string } {
  const tone = STATUS_TONES[status as TrailStatusTone] ?? STATUS_TONES.maintenance;
  return dark
    ? { backgroundColor: tone.dark + DARK_TINT_ALPHA, color: tone.dark }
    : { backgroundColor: tone.light.background, color: tone.light.color };
}
