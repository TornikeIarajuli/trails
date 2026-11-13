/**
 * Centralized React Query key factory.
 * All queryKey arrays must come from here — never inline `['feature', ...]` strings.
 */
export const queryKeys = {
  // Trails (list, detail, regions, nearby)
  trails: (params?: object) => ['trails', params] as const,
  trailLists: () => ['trails'] as const,     // wildcard: invalidates every trail list
  trail: {
    detail: (id: string) => ['trail', id] as const,
    root: () => ['trail'] as const,          // wildcard: invalidates all trail details
  },
  regions: () => ['regions'] as const,
  nearbyTrails: (lat?: number, lng?: number, radiusKm?: number) =>
    ['nearbyTrails', lat, lng, radiusKm] as const,

  // Recommendations
  recommendations: () => ['recommendations'] as const,

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
    list: (category?: string) => ['bookmarks', 'list', category ?? 'all'] as const,
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
  // Client-side record of the user's own photo likes — deliberately not under 'photos',
  // so invalidating the photo lists does not reset it
  photoLikes: () => ['photoLikes'] as const,

  // Completions
  completions: {
    mine: () => ['completions', 'me'] as const,
    trail: (trailId: string) => ['completions', 'trail', trailId] as const,
    root: () => ['completions'] as const,    // wildcard
  },

  // User profile
  profile: {
    me: () => ['profile', 'me'] as const,
    // Under 'profile' so recording or deleting a hike (which invalidates the profile) refreshes it
    regions: (userId?: string) => ['profile', 'regions', userId ?? 'me'] as const,
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
    list: (kind: 'followers' | 'following', userId: string) => ['follows', kind, userId] as const,
    counts: (userId: string) => ['follows', 'counts', userId] as const,
    root: () => ['follows'] as const,        // wildcard
    publicProfile: (userId: string) => ['publicProfile', userId] as const,
  },

  // The signed-in user's emergency contact id
  emergencyContact: () => ['myEmergencyContact'] as const,

  // User search
  userSearch: (query: string) => ['userSearch', query] as const,

  // Moderation
  moderation: {
    blocks: () => ['moderation', 'blocks'] as const,
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

  // Activity comments
  comments: {
    activity: (activityId: string) => ['comments', activityId] as const,
  },

  // Activity likes
  likes: {
    activity: (activityId: string) => ['likes', activityId] as const,
  },

  // Active hikes (congestion)
  activeHikes: {
    count: (trailId: string) => ['activeHikes', 'count', trailId] as const,
  },

  // Notifications
  notifications: {
    list: (page: number) => ['notifications', 'list', page] as const,
    feed: () => ['notifications', 'feed'] as const,
    unreadCount: () => ['notifications', 'unreadCount'] as const,
    prefs: () => ['notifications', 'prefs'] as const,
    root: () => ['notifications'] as const,
  },

  // Events
  events: {
    trail: (trailId: string) => ['events', 'trail', trailId] as const,
    detail: (id: string) => ['events', id] as const,
    root: () => ['events'] as const,
  },
};
