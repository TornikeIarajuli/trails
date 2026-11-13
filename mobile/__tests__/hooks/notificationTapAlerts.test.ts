/**
 * What tapping a push notification does now that notifications live in the
 * Alerts tab: the target opens on top of the notification list, so Back lands
 * on the list. The payload → destination mapping itself is covered by
 * __tests__/utils/notificationTarget.test.ts.
 */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
// Not under test here: the push library itself and the query client's network wiring
jest.mock('expo-notifications', () => ({}));
jest.mock('../../utils/queryClient', () => ({ queryClient: { clear: jest.fn() } }));

import { Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import { navigateFromNotification } from '../../hooks/useNotifications';

const push = router.push as jest.Mock;
const navigate = router.navigate as jest.Mock;
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
let openURL: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  openURL.mockRestore();
});

describe('navigateFromNotification (Alerts tab)', () => {
  it.each([
    [{ type: 'new_follower', followerId: 'u-1' }, '/trail/user/u-1'],
    [{ type: 'event_invite', eventId: 'e-1', trailId: 't-1', userId: 'u-2' }, '/trail/t-1/event/e-1'],
    [{ type: 'event_update', eventId: 'e-1', trailId: 't-1', cancelled: false }, '/trail/t-1/event/e-1'],
    [{ type: 'completion_approved', completionId: 'c-1', trailId: 't-1' }, '/trail/completion/c-1'],
    [{ type: 'emergency_contact', setterId: 'u-3' }, '/trail/user/u-3'],
  ])('opens the Alerts tab, then the screen for %j on top of it', (data, href) => {
    navigateFromNotification(data);

    expect(navigate).toHaveBeenCalledWith('/(tabs)/alerts');
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(href);
    // The list is opened first, so Back from the target lands on it
    expect(navigate.mock.invocationCallOrder[0]).toBeLessThan(push.mock.invocationCallOrder[0]);
    expect(openURL).not.toHaveBeenCalled();
  });

  it('opens the badges screen inside the Alerts tab, with the list underneath it', () => {
    navigateFromNotification({ type: 'badge_earned', badgeIds: ['b-1'] });

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/(tabs)/alerts/badges', { withAnchor: true });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the commented item for new_comment, or nothing when the payload has no trail', () => {
    navigateFromNotification({ type: 'new_comment', activityId: 'a-1', activityType: 'review', trailId: 't-1' });
    expect(push).toHaveBeenCalledWith('/trail/t-1');

    push.mockClear();
    navigateFromNotification({ type: 'new_comment', activityId: 'a-1', activityType: 'photo', commenterId: 'u-2' });
    expect(push).not.toHaveBeenCalled();
  });

  it('opens the position of an SOS in the maps app and shows the Alerts tab', async () => {
    navigateFromNotification({ type: 'sos', userId: 'u-9', lat: 42.6655, lng: 44.6146 });
    await settle();

    expect(push).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/(tabs)/alerts');
    expect(openURL).toHaveBeenCalledTimes(1);
    const url: string = openURL.mock.calls[0][0];
    expect(url).toContain('42.6655');
    expect(url).toContain('44.6146');
    expect(url.startsWith(Platform.OS === 'ios' ? 'http://maps.apple.com/' : 'geo:')).toBe(true);
  });

  it('falls back to a web map when the maps app cannot be opened', async () => {
    openURL.mockRejectedValueOnce(new Error('No activity found to handle intent'));

    navigateFromNotification({ type: 'sos', userId: 'u-9', lat: 42.6655, lng: 44.6146 });
    await settle();

    expect(openURL).toHaveBeenCalledTimes(2);
    expect(openURL.mock.calls[1][0]).toMatch(/^https:\/\//);
  });

  it('opens the sender of an SOS that came without a position on top of the list', () => {
    navigateFromNotification({ type: 'sos', userId: 'u-9' });

    expect(navigate).toHaveBeenCalledWith('/(tabs)/alerts');
    expect(push).toHaveBeenCalledWith('/trail/user/u-9');
    expect(openURL).not.toHaveBeenCalled();
  });

  it('does nothing for a payload it does not know', () => {
    navigateFromNotification({ type: 'something_new', id: 'x' });
    navigateFromNotification({});
    navigateFromNotification(null);

    expect(push).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('never routes to a screen that does not exist, and never to another tab', () => {
    const existing = [
      /^\/trail\/user\/[^/]+$/,
      /^\/\(tabs\)\/alerts\/badges$/,
      /^\/trail\/[^/]+\/event\/[^/]+$/,
      /^\/trail\/[^/]+$/,
      /^\/trail\/completion\/[^/]+$/,
    ];
    const payloads = [
      { type: 'new_follower', followerId: 'u' },
      { type: 'badge_earned' },
      { type: 'new_comment', activityId: 'a', activityType: 'review', trailId: 't' },
      { type: 'new_comment', activityId: 'a', activityType: 'completion' },
      { type: 'new_comment', activityId: 'a', activityType: 'event', trailId: 't' },
      { type: 'event_invite', eventId: 'e', trailId: 't' },
      { type: 'event_update', eventId: 'e', trailId: 't', cancelled: true },
      { type: 'completion_approved', completionId: 'c', trailId: 't' },
      { type: 'completion_approved', trailId: 't' },
      { type: 'emergency_contact', setterId: 'u' },
      { type: 'sos', userId: 'u' },
    ];

    for (const payload of payloads) navigateFromNotification(payload);

    expect(push).toHaveBeenCalledTimes(payloads.length);
    for (const [href] of push.mock.calls) {
      expect(existing.some((pattern) => pattern.test(href))).toBe(true);
    }
    for (const [href] of navigate.mock.calls) {
      expect(href).toBe('/(tabs)/alerts');
    }
  });

  it('does not crash the app when the navigator is not ready', () => {
    navigate.mockImplementationOnce(() => {
      throw new Error('Attempted to navigate before mounting the Root Layout component');
    });
    expect(() => navigateFromNotification({ type: 'new_follower', followerId: 'u-1' })).not.toThrow();
  });
});
