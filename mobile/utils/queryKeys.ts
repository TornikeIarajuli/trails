/**
 * Centralized React Query key factory.
 * All queryKey arrays must come from here — never inline `['feature', ...]` strings.
 */
export const queryKeys = {
  // Trails (list, detail, regions, nearby)
  trails: (params?: object) => ['trails', params] as const,
  trail: {
    detail: (id: string) => ['trail', id] as const,
    root: () => ['trail'] as const,          // wildcard: invalidates all trail details
  },
  regions: () => ['regions'] as const,
  nearbyTrails: (lat?: number, lng?: number, radiusKm?: number) =>
    ['nearbyTrails', lat, lng, radiusKm] as const,

  // Badges
  badges: {
    all: () => ['badges', 'all'] as const,
    mine: () => ['badges', 'me'] as const,
    progress: () => ['badges', 'progress'] as const,
    root: () => ['badges'] as const,         // wildcard
  },

  // Bookmarks
  bookmarks: {
    mine: (page: number) => ['bookmarks', 'me', page] as const,
    check: (trailId: string) => ['bookmarks', 'check', trailId] as const,
    root: () => ['bookmarks'] as const,      // wildcard
  },

  // Trail conditions
  conditions: {
    trail: (trailId: string) => ['conditions', trailId] as const,
  },

  // Community photos
  photos: {
    trail: (trailId: string) => ['photos', trailId] as const,
    root: () => ['photos'] as const,         // wildcard
  },

  // Completions
  completions: {
    mine: () => ['completions', 'me'] as const,
    trail: (trailId: string) => ['completions', 'trail', trailId] as const,
    root: () => ['completions'] as const,    // wildcard
  },

  // User profile
  profile: {
    me: () => ['profile', 'me'] as const,
    root: () => ['profile'] as const,        // wildcard
  },

  // Activity feed
  feed: () => ['feed'] as const,

  // Reviews
  reviews: {
    trail: (trailId: string) => ['reviews', trailId] as const,
  },

  // Follows
  follows: {
    check: (userId: string) => ['follows', 'check', userId] as const,
    followers: (userId: string, page: number) => ['follows', 'followers', userId, page] as const,
    following: (userId: string, page: number) => ['follows', 'following', userId, page] as const,
    counts: (userId: string) => ['follows', 'counts', userId] as const,
    root: () => ['follows'] as const,        // wildcard
    publicProfile: (userId: string) => ['publicProfile', userId] as const,
  },

  // Leaderboard
  leaderboard: (limit: number) => ['leaderboard', limit] as const,

  // Weather
  weather: (lat: number, lng: number) => ['weather', lat, lng] as const,

  // Shop
  shop: {
    all: () => ['products'] as const,
    detail: (id: string) => ['product', id] as const,
  },

  // Checkpoints
  checkpoints: {
    trail: (trailId: string) => ['checkpoints', trailId] as const,
    completions: {
      mine: (trailId: string) => ['checkpointCompletions', 'me', trailId] as const,
      root: () => ['checkpointCompletions'] as const,  // wildcard
    },
  },
};
