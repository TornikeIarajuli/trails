import PostHog from 'posthog-react-native';

// Singleton PostHog instance — initialized once in _layout.tsx via PostHogProvider.
// Use the usePostHog() hook in components, or call these helpers for non-component code.

let _client: PostHog | null = null;

export function initAnalytics(): PostHog {
  if (!_client) {
    _client = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '', {
      host: 'https://eu.i.posthog.com',
      disabled: !process.env.EXPO_PUBLIC_POSTHOG_KEY,
    });
  }
  return _client;
}

export function getAnalytics(): PostHog | null {
  return _client;
}

export function identify(userId: string, props?: Record<string, string | number | boolean | null>) {
  _client?.identify(userId, props as any);
}

export function reset() {
  _client?.reset();
}

// Typed event helpers
export const analytics = {
  trailViewed: (trailId: string, trailName: string) =>
    _client?.capture('trail_viewed', { trail_id: trailId, trail_name: trailName }),

  hikeStarted: (trailId: string, trailName: string) =>
    _client?.capture('hike_started', { trail_id: trailId, trail_name: trailName }),

  hikeCompleted: (trailId: string, durationSeconds: number, distanceKm: number) =>
    _client?.capture('hike_completed', { trail_id: trailId, duration_seconds: durationSeconds, distance_km: distanceKm }),

  hikeAbandoned: (trailId: string, durationSeconds: number) =>
    _client?.capture('hike_abandoned', { trail_id: trailId, duration_seconds: durationSeconds }),

  reviewWritten: (trailId: string, rating: number) =>
    _client?.capture('review_written', { trail_id: trailId, rating }),

  trailBookmarked: (trailId: string) =>
    _client?.capture('trail_bookmarked', { trail_id: trailId }),

  photoUploaded: (context: 'hike' | 'community' | 'profile') =>
    _client?.capture('photo_uploaded', { context }),

  eventJoined: (eventId: string) =>
    _client?.capture('event_joined', { event_id: eventId }),

  searchPerformed: (query: string) =>
    _client?.capture('search_performed', { query }),
};
