import PostHog from 'posthog-react-native';

// Singleton PostHog instance — initialized once in _layout.tsx via PostHogProvider.
// Use the usePostHog() hook in components, or call these helpers for non-component code.
//
// A build without EXPO_PUBLIC_POSTHOG_KEY has no client at all: PostHog refuses
// an empty key, so analytics is simply off and every helper below does nothing.

let _client: PostHog | null = null;
let _initialized = false;

export function initAnalytics(): PostHog | null {
  if (_initialized) return _client;
  _initialized = true;

  const apiKey = (process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '').trim();
  if (!apiKey) return null;

  try {
    _client = new PostHog(apiKey, {
      host: 'https://us.i.posthog.com',
      // Crash reports: errors nothing caught, and promises nobody handled. A crash that
      // closes the app is sent the next time it starts.
      errorTracking: { autocapture: { uncaughtExceptions: true, unhandledRejections: true, console: false } },
    });
    // Which over-the-air update was running, on every event and crash report
    void Promise.resolve(_client.register(releaseProperties())).catch(() => {});
  } catch (error) {
    console.warn('[analytics] PostHog could not be started', error);
  }
  return _client;
}

function releaseProperties(): Record<string, string> {
  try {
    // Loaded lazily: expo-updates is native, and tests run without it
    const Updates = require('expo-updates') as typeof import('expo-updates');
    return {
      update_id: Updates.updateId ?? 'embedded',
      runtime_version: Updates.runtimeVersion ?? 'unknown',
      update_channel: Updates.channel ?? 'unknown',
    };
  } catch {
    return {};
  }
}

/**
 * Sends an error that the app caught (so it did not crash) as a crash report, with where it
 * happened. Does nothing without analytics.
 */
export function reportError(error: unknown, context?: Record<string, string | number | boolean | null>) {
  try {
    _client?.captureException(error, context);
  } catch {
    // Reporting must never make things worse
  }
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

  badgeEarned: (badgeKey: string, badgeName: string) =>
    _client?.capture('badge_earned', { badge_key: badgeKey, badge_name: badgeName }),
};
