import type { FeedItem } from '../types/feed';
import { formatDistance } from './formatters';

/** What happened, between the username and the trail name: "nino completed Juta to Roshka". */
export function feedAction(type: string): string {
  switch (type) {
    case 'completion':
      return 'completed';
    case 'photo':
      return 'added a photo on';
    case 'condition':
      return 'reported conditions on';
    case 'review':
      return 'reviewed';
    default:
      return 'was on';
  }
}

export type PostMediaKind = 'photos' | 'cover' | 'none';

/**
 * The pictures a post shows: the hiker's own photos when there are any; for a completion
 * without photos, the trail's cover; otherwise none (the post becomes a compact card).
 */
export function feedMedia(item: FeedItem): { urls: string[]; kind: PostMediaKind } {
  const valid = (urls: (string | null | undefined)[]) =>
    [...new Set(urls.filter((url): url is string => typeof url === 'string' && url.length > 0))];
  // A completion's photos are those taken on the hike; its single photo_url is only the
  // fallback (the newest of them, or the proof photo when there are none)
  const hikePhotos = item.activity_type === 'completion' ? valid(item.photo_urls ?? []) : [];
  const own = hikePhotos.length > 0 ? hikePhotos : valid([item.photo_url]);
  if (own.length > 0) return { urls: own, kind: 'photos' };
  if (item.activity_type === 'completion' && item.trail_cover_image_url) {
    return { urls: [item.trail_cover_image_url], kind: 'cover' };
  }
  return { urls: [], kind: 'none' };
}

/** "1 like", "1,204 likes"; empty for none. */
export function likesLabel(count: number): string {
  if (!count || count < 0) return '';
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'like' : 'likes'}`;
}

/** The link under a post that opens its comments; null when there are none yet. */
export function commentsLinkLabel(count: number): string | null {
  if (!count || count < 0) return null;
  if (count === 1) return 'View 1 comment';
  return `View all ${count.toLocaleString('en-US')} comments`;
}

const CONDITION_LABELS: Record<string, string> = {
  trail_clear: 'Trail clear',
  muddy: 'Muddy',
  snow: 'Snow',
  fallen_tree: 'Fallen tree',
  flooded: 'Flooded',
  overgrown: 'Overgrown',
  damaged: 'Damaged',
  closed: 'Closed',
};

export function conditionLabel(conditionType: string | null | undefined): string {
  if (!conditionType) return '';
  return CONDITION_LABELS[conditionType] ?? conditionType.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** A review's rating, from the post's extra text, as 0–5 whole stars. */
export function reviewStars(extraText: string | null | undefined): number {
  const n = parseInt(extraText ?? '', 10);
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 0;
}

/** "45 min", "4h 20m". */
export function formatElapsed(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export interface StatChip {
  key: 'distance' | 'ascent' | 'time' | 'past';
  icon: string;
  label: string;
}

export interface TrailStats {
  distance_km: number | null;
  elevation_gain_m: number | null;
}

/**
 * Chips under a completion: distance, ascent and the hiker's time. The feed may not carry the
 * hike's own numbers, so distance and ascent fall back to the trail's. A past hike (marked as
 * done, hiked before the app) has no time and says so instead.
 */
export function completionChips(item: FeedItem, trail: TrailStats | undefined): StatChip[] {
  if (item.activity_type !== 'completion') return [];
  const chips: StatChip[] = [];
  const distance = item.distance_km ?? trail?.distance_km ?? null;
  const ascent = item.elevation_gain_m ?? trail?.elevation_gain_m ?? null;
  if (distance != null && distance > 0) chips.push({ key: 'distance', icon: 'walk-outline', label: formatDistance(distance) });
  if (ascent != null && ascent > 0) chips.push({ key: 'ascent', icon: 'trending-up', label: `${Math.round(ascent)} m` });
  if (item.source === 'past') {
    chips.push({ key: 'past', icon: 'time-outline', label: 'Hiked before the app' });
  } else if (typeof item.elapsed_seconds === 'number' && item.elapsed_seconds > 0) {
    chips.push({ key: 'time', icon: 'time-outline', label: formatElapsed(item.elapsed_seconds) });
  }
  return chips;
}

/** What the share sheet sends for a post: who did what, where, and a link to the trail. */
export function shareMessage(item: FeedItem): string {
  return `${item.user_username} ${feedAction(item.activity_type)} ${item.trail_name_en} on Mikiri Trails.\n\nmikiri-trails://trail/${item.trail_id}`;
}
