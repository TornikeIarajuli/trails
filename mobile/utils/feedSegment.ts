/**
 * The Feed tab's segments: people you follow, everyone (Discover), the good hiking days ahead,
 * and the leaderboard ("Ranks", once its own tab).
 */
export type FeedSegment = 'activity' | 'discover' | 'gooddays' | 'leaderboard';

export const FEED_SEGMENTS: readonly { key: FeedSegment; label: string }[] = [
  { key: 'activity', label: 'Following' },
  { key: 'discover', label: 'Discover' },
  { key: 'gooddays', label: 'Good days' },
  // Short, so four segments fit across a phone
  { key: 'leaderboard', label: 'Ranks' },
];

const KEYS = new Set<string>(FEED_SEGMENTS.map((s) => s.key));

/** The segment a `segment` route param asks for, or null when it asks for none (or for an unknown one). */
export function feedSegmentFromParam(value: string | string[] | undefined): FeedSegment | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && KEYS.has(raw) ? (raw as FeedSegment) : null;
}

/** Where the leaderboard lives now; old links to `/(tabs)/leaderboard` are sent here. */
export const LEADERBOARD_HREF = {
  pathname: '/(tabs)/feed',
  params: { segment: 'leaderboard' },
} as const;
