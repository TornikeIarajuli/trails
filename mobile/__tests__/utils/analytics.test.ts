/**
 * A build without EXPO_PUBLIC_POSTHOG_KEY must start and run without analytics:
 * PostHog throws when it is constructed with an empty key.
 */
jest.mock('posthog-react-native', () => {
  const PostHog = jest.fn(function (this: Record<string, unknown>, apiKey: string) {
    if (!apiKey) throw new Error("You must pass your PostHog project's api key.");
    this.capture = jest.fn();
    this.identify = jest.fn();
    this.reset = jest.fn();
  });
  return { __esModule: true, default: PostHog };
});

type AnalyticsModule = typeof import('../../utils/analytics');

const ORIGINAL_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;

/** Loads a fresh copy of the module as it would start in a build with this key. */
function loadWithKey(key: string | undefined): { analytics: AnalyticsModule; PostHog: jest.Mock } {
  if (key === undefined) delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
  else process.env.EXPO_PUBLIC_POSTHOG_KEY = key;

  let loaded: { analytics: AnalyticsModule; PostHog: jest.Mock } | undefined;
  jest.isolateModules(() => {
    loaded = {
      PostHog: require('posthog-react-native').default,
      analytics: require('../../utils/analytics'),
    };
  });
  return loaded!;
}

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
  else process.env.EXPO_PUBLIC_POSTHOG_KEY = ORIGINAL_KEY;
});

describe.each([
  ['missing', undefined],
  ['empty', ''],
  ['blank', '   '],
])('when the PostHog key is %s', (_name, key) => {
  it('creates no client', () => {
    const { analytics, PostHog } = loadWithKey(key);

    expect(analytics.initAnalytics()).toBeNull();
    expect(analytics.getAnalytics()).toBeNull();
    expect(PostHog).not.toHaveBeenCalled();
  });

  it('turns every helper into a no-op', () => {
    const { analytics } = loadWithKey(key);
    analytics.initAnalytics();

    expect(() => {
      analytics.identify('user-1', { email: 'nino@example.com' });
      analytics.reset();
      analytics.analytics.trailViewed('t-1', 'Kazbegi');
      analytics.analytics.hikeStarted('t-1', 'Kazbegi');
      analytics.analytics.hikeCompleted('t-1', 3600, 6.1);
      analytics.analytics.hikeAbandoned('t-1', 60);
      analytics.analytics.badgeEarned('first', 'First Hike');
    }).not.toThrow();
  });
});

describe('when the PostHog key is set', () => {
  it('creates the client once and reuses it', () => {
    const { analytics, PostHog } = loadWithKey('phc_test_key');

    const client = analytics.initAnalytics();
    expect(client).not.toBeNull();
    expect(analytics.initAnalytics()).toBe(client);
    expect(analytics.getAnalytics()).toBe(client);
    expect(PostHog).toHaveBeenCalledTimes(1);
    expect(PostHog).toHaveBeenCalledWith('phc_test_key', expect.objectContaining({ host: expect.any(String) }));
  });

  it('sends events through the client', () => {
    const { analytics } = loadWithKey('phc_test_key');
    const client = analytics.initAnalytics() as unknown as { capture: jest.Mock; identify: jest.Mock };

    analytics.analytics.hikeStarted('t-1', 'Kazbegi');
    analytics.identify('user-1', { email: 'nino@example.com' });

    expect(client.capture).toHaveBeenCalledWith('hike_started', { trail_id: 't-1', trail_name: 'Kazbegi' });
    expect(client.identify).toHaveBeenCalledWith('user-1', { email: 'nino@example.com' });
  });

  it('does without analytics if the client cannot be created', () => {
    const { analytics, PostHog } = loadWithKey('phc_test_key');
    PostHog.mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(analytics.initAnalytics()).toBeNull();
    expect(() => analytics.analytics.trailViewed('t-1', 'Kazbegi')).not.toThrow();

    warn.mockRestore();
  });
});
