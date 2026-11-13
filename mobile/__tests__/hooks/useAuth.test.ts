/**
 * Signing in and out: what happens to the session, the cache, the push token,
 * GPS tracking and a hike in progress. Stores are real; the network, the router
 * and secure storage are mocked.
 */
const mockSecureStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock('../../utils/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('../../utils/analytics', () => ({ identify: jest.fn(), reset: jest.fn() }));
jest.mock('../../utils/hikeSession', () => ({ discardActiveHike: jest.fn() }));
jest.mock('../../services/auth', () => ({ authService: { logout: jest.fn() } }));
jest.mock('../../services/notifications', () => ({ notificationsService: { removeToken: jest.fn() } }));

import { router } from 'expo-router';
import { isEmailNotConfirmed, logout, startSession } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { notificationsService } from '../../services/notifications';
import { useAuthStore } from '../../store/authStore';
import { useHikeStore, whenHikeStoreHydrated } from '../../store/hikeStore';
import { reset as resetAnalytics } from '../../utils/analytics';
import { discardActiveHike } from '../../utils/hikeSession';
import { flushHikeStorage } from '../../utils/hikeStorage';
import { queryClient } from '../../utils/queryClient';

const remoteLogout = authService.logout as jest.Mock;
const removeToken = notificationsService.removeToken as jest.Mock;
const discard = discardActiveHike as jest.Mock;
const clearCache = queryClient.clear as jest.Mock;
const replace = router.replace as jest.Mock;
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

const user = { id: 'user-1', email: 'nino@example.com', user_metadata: { username: 'nino' } };
const PUSH_TOKEN = 'ExponentPushToken[device-1]';

beforeAll(async () => {
  await whenHikeStoreHydrated();
});

beforeEach(() => {
  mockSecureStore.clear();
  useAuthStore.getState().setSession(user, 'access-1', 'refresh-1');
  mockSecureStore.set('push_token', PUSH_TOKEN);
  useHikeStore.setState({ isActive: false, trailId: null, ownerId: null, pendingCompletions: [] });
  jest.clearAllMocks();
  remoteLogout.mockResolvedValue(undefined);
  removeToken.mockResolvedValue({ removed: true });
});

afterEach(async () => {
  await settle();
  await flushHikeStorage();
});

describe('logout', () => {
  it('signs out on the device and goes to the login screen', async () => {
    await logout();

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
    expect(mockSecureStore.has('refresh_token')).toBe(false);
    expect(mockSecureStore.has('auth_user')).toBe(false);
    expect(clearCache).toHaveBeenCalled();
    expect(resetAnalytics).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('stops tracking and drops the hike in progress', async () => {
    await logout();
    expect(discard).toHaveBeenCalledTimes(1);
  });

  it("unregisters this device's push token with the token of the session being closed", async () => {
    await logout();
    await settle();

    expect(removeToken).toHaveBeenCalledTimes(1);
    expect(removeToken).toHaveBeenCalledWith(
      PUSH_TOKEN,
      expect.objectContaining({
        headers: { Authorization: 'Bearer access-1' },
        skipAuthRefresh: true,
      }),
    );
    expect(mockSecureStore.has('push_token')).toBe(false);
  });

  it('asks the server to revoke the session, after the push token is gone', async () => {
    const order: string[] = [];
    removeToken.mockImplementation(async () => {
      order.push('remove-token');
      return { removed: true };
    });
    remoteLogout.mockImplementation(async () => {
      order.push('logout');
    });

    await logout();
    await settle();

    expect(order).toEqual(['remove-token', 'logout']);
    expect(remoteLogout).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { Authorization: 'Bearer access-1' }, skipAuthRefresh: true }),
    );
  });

  it('keeps the push token of an account that signs in while the old one is still being unregistered', async () => {
    let finishRemoval: () => void = () => {};
    removeToken.mockReturnValue(new Promise((resolve) => (finishRemoval = () => resolve({ removed: true }))));

    await logout();
    await settle();
    // The next account signs in and registers this device again
    mockSecureStore.set('push_token', PUSH_TOKEN);
    finishRemoval();
    await settle();

    expect(mockSecureStore.get('push_token')).toBe(PUSH_TOKEN);
  });

  it('revokes the session even when the device never registered a push token', async () => {
    mockSecureStore.delete('push_token');

    await logout();
    await settle();

    expect(removeToken).not.toHaveBeenCalled();
    expect(remoteLogout).toHaveBeenCalledTimes(1);
  });

  it('works without a connection', async () => {
    removeToken.mockRejectedValue(new Error('Network Error'));
    remoteLogout.mockRejectedValue(new Error('Network Error'));

    await expect(logout()).resolves.toBeUndefined();
    await settle();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(replace).toHaveBeenCalledWith('/(auth)/login');
    // Still asked for the session to be revoked after the push token call failed
    expect(remoteLogout).toHaveBeenCalledTimes(1);
  });

  it('does not wait for the server', async () => {
    removeToken.mockReturnValue(new Promise(() => {})); // a server that never answers

    await logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('keeps hikes that are waiting to upload, for when their owner signs in again', async () => {
    useHikeStore.setState({
      pendingCompletions: [
        {
          localId: 'local-1',
          userId: 'user-1',
          trailId: 'trail-1',
          elapsedSeconds: 60,
          startedAt: null,
          completedAt: '2026-11-13T08:00:00.000Z',
          distanceM: null,
          track: [],
          attempts: 0,
        },
      ],
    });

    await logout();

    expect(useHikeStore.getState().pendingCompletions).toHaveLength(1);
  });

  it('makes no server calls when there is no session to close', async () => {
    useAuthStore.getState().clearSession();
    jest.clearAllMocks();

    await logout();
    await settle();

    expect(removeToken).not.toHaveBeenCalled();
    expect(remoteLogout).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('can be used directly as a press handler', async () => {
    const pressEvent = { nativeEvent: {} };
    await (logout as (event?: unknown) => Promise<void>)(pressEvent);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe('startSession (login and signup)', () => {
  const other = { id: 'user-2', email: 'gio@example.com', user_metadata: { username: 'gio' } };

  beforeEach(() => {
    useAuthStore.getState().clearSession();
    jest.clearAllMocks();
  });

  it('stores the session and clears what the previous account left in the cache', () => {
    startSession(other, 'access-2', 'refresh-2');

    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
    });
    expect(useAuthStore.getState().user?.id).toBe('user-2');
  });

  it('discards a hike that another account left running', () => {
    useHikeStore.setState({ isActive: true, trailId: 'trail-1', ownerId: 'user-1' });
    startSession(other, 'access-2', 'refresh-2');
    expect(discard).toHaveBeenCalledTimes(1);
  });

  it('keeps the hike of the account that signs back in (session expired mid-hike)', () => {
    useHikeStore.setState({ isActive: true, trailId: 'trail-1', ownerId: 'user-2' });
    startSession(other, 'access-2', 'refresh-2');
    expect(discard).not.toHaveBeenCalled();
  });

  it('keeps a hike whose owner is unknown', () => {
    useHikeStore.setState({ isActive: true, trailId: 'trail-1', ownerId: null });
    startSession(other, 'access-2', 'refresh-2');
    expect(discard).not.toHaveBeenCalled();
  });
});

describe('isEmailNotConfirmed', () => {
  it('recognises the code the backend sends for an unconfirmed account', () => {
    expect(
      isEmailNotConfirmed({ response: { status: 403, data: { message: 'Email not confirmed', code: 'EMAIL_NOT_CONFIRMED' } } }),
    ).toBe(true);
  });

  it('is false for wrong credentials and for errors without a response', () => {
    expect(isEmailNotConfirmed({ response: { status: 401, data: { message: 'Invalid email or password' } } })).toBe(false);
    expect(isEmailNotConfirmed(new Error('Network Error'))).toBe(false);
    expect(isEmailNotConfirmed(null)).toBe(false);
  });
});
