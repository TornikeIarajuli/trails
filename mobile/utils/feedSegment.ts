/**
 * The Feed tab's segments: people you follow, everyone (Discover), and the leaderboard, which
 * used to be its own "Ranks" tab.
 */
export type FeedSegment = 'activity' | 'discover' | 'leaderboard';

export const FEED_SEGMENTS: readonly { key: FeedSegment; label: string }[] = [
  { key: 'activity', label: 'Following' },
  { key: 'discover', label: 'Discover' },
  { key: 'leaderboard', label: 'Leaderboard' },
];

/** The segment a `segment` route param asks for, or null when it asks for none (or for an unknown one). */
export function feedSegmentFromParam(value: string | string[] | undefined): FeedSegment | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'activity' || raw === 'discover' || raw === 'leaderboard' ? raw : null;
}

/** Where the leaderboard lives now; old links to `/(tabs)/leaderboard` are sent here. */
export const LEADERBOARD_HREF = {
  pathname: '/(tabs)/feed',
  params: { segment: 'leaderboard' },
} as const;
