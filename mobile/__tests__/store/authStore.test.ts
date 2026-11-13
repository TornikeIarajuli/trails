/**
 * Session handling: what is restored at launch, when the user is signed out,
 * and what is kept on the device. Secure storage is an in-memory map and the
 * refresh endpoint is whatever each test makes `axios.post` do.
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
jest.mock('../../utils/queryClient', () => ({
  queryClient: { clear: jest.fn() },
}));

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { refreshSession, useAuthStore } from '../../store/authStore';
import { queryClient } from '../../utils/queryClient';

const post = jest.spyOn(axios, 'post');
const clearCache = queryClient.clear as jest.Mock;
const auth = () => useAuthStore.getState();
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

const serverUser = {
  id: 'user-1',
  email: 'nino@example.com',
  user_metadata: { username: 'nino', full_name: 'Nino K' },
  app_metadata: { provider: 'email' } as { provider: string; role?: string },
  aud: 'authenticated',
};
const storedUser = { id: 'user-1', email: 'nino@example.com', username: 'nino', full_name: 'Nino K', role: null };

const refreshed = (user: unknown = serverUser) => ({
  data: { user, session: { access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 3600 } },
});
const httpError = (status: number) => ({ isAxiosError: true, response: { status, data: {} } });
const networkError = () => ({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' });
const timeoutError = () => ({ isAxiosError: true, code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' });

function saveSession({ withUser = true } = {}) {
  mockSecureStore.set('access_token', 'access-1');
  mockSecureStore.set('refresh_token', 'refresh-1');
  if (withUser) mockSecureStore.set('auth_user', JSON.stringify(storedUser));
}

beforeEach(() => {
  mockSecureStore.clear();
  jest.clearAllMocks();
  post.mockReset();
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isAdmin: false,
    isLoading: true,
  });
});

afterEach(async () => {
  // Let background refreshes and storage writes finish before the next test
  await settle();
});

describe('restoreSession', () => {
  it('starts signed out when nothing is saved, without calling the server', async () => {
    await auth().restoreSession();

    expect(auth().isAuthenticated).toBe(false);
    expect(auth().isLoading).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it('opens the app with the saved session before the server has answered', async () => {
    saveSession();
    let answer: (value: unknown) => void = () => {};
    post.mockReturnValueOnce(new Promise((resolve) => (answer = resolve))); // a sleeping server

    await auth().restoreSession();

    expect(post).toHaveBeenCalledTimes(1);
    expect(auth().isLoading).toBe(false);
    expect(auth().isAuthenticated).toBe(true);
    expect(auth().accessToken).toBe('access-1');
    expect(auth().refreshToken).toBe('refresh-1');
    expect(auth().user).toEqual({
      id: 'user-1',
      email: 'nino@example.com',
      user_metadata: { username: 'nino', full_name: 'Nino K' },
      app_metadata: {},
    });

    answer(refreshed());
  });

  it('then refreshes in the background and stores the new tokens', async () => {
    saveSession();
    post.mockResolvedValueOnce(refreshed());

    await auth().restoreSession();
    await settle();

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatch(/\/auth\/refresh$/);
    expect(post.mock.calls[0][1]).toEqual({ refresh_token: 'refresh-1' });
    expect(auth().accessToken).toBe('access-2');
    expect(auth().refreshToken).toBe('refresh-2');
    expect(mockSecureStore.get('access_token')).toBe('access-2');
    expect(mockSecureStore.get('refresh_token')).toBe('refresh-2');
    expect(clearCache).not.toHaveBeenCalled();
  });

  it('gives the refresh request a timeout', async () => {
    saveSession();
    post.mockResolvedValueOnce(refreshed());

    await auth().restoreSession();
    await settle();

    expect((post.mock.calls[0][2] as { timeout?: number }).timeout).toBeGreaterThan(0);
  });

  it.each([
    ['there is no connection', networkError],
    ['the server does not answer in time', timeoutError],
    ['the server reports trouble upstream (503)', () => httpError(503)],
    ['the server fails (500)', () => httpError(500)],
  ])('keeps the user signed in, with their identity, when %s', async (_name, failure) => {
    saveSession();
    post.mockRejectedValueOnce(failure());

    await auth().restoreSession();
    await settle();

    expect(auth().isAuthenticated).toBe(true);
    expect(auth().user?.id).toBe('user-1');
    expect(auth().user?.user_metadata.username).toBe('nino');
    expect(mockSecureStore.get('refresh_token')).toBe('refresh-1');
    expect(clearCache).not.toHaveBeenCalled();
  });

  it.each([401, 403])('signs out when the server rejects the refresh token (%i)', async (status) => {
    saveSession();
    post.mockRejectedValueOnce(httpError(status));

    await auth().restoreSession();
    await settle();

    expect(auth().isAuthenticated).toBe(false);
    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();
    expect(mockSecureStore.has('access_token')).toBe(false);
    expect(mockSecureStore.has('refresh_token')).toBe(false);
    expect(mockSecureStore.has('auth_user')).toBe(false);
    expect(clearCache).toHaveBeenCalledTimes(1);
  });

  describe('a session saved by a version that did not keep the user', () => {
    it('waits for the server to learn who is signed in', async () => {
      saveSession({ withUser: false });
      let answer: (value: unknown) => void = () => {};
      post.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

      const restoring = auth().restoreSession();
      await settle();
      expect(auth().isLoading).toBe(true);

      answer(refreshed());
      await restoring;

      expect(auth().isLoading).toBe(false);
      expect(auth().isAuthenticated).toBe(true);
      expect(auth().user?.id).toBe('user-1');
      expect(JSON.parse(mockSecureStore.get('auth_user') ?? 'null')).toEqual(storedUser);
    });

    it('keeps the tokens when the server cannot be reached', async () => {
      saveSession({ withUser: false });
      post.mockRejectedValueOnce(networkError());

      await auth().restoreSession();

      expect(auth().isLoading).toBe(false);
      expect(auth().isAuthenticated).toBe(true);
      expect(auth().accessToken).toBe('access-1');
      expect(auth().user).toBeNull();
      expect(mockSecureStore.get('refresh_token')).toBe('refresh-1');
    });

    it('signs out when the server rejects the refresh token', async () => {
      saveSession({ withUser: false });
      post.mockRejectedValueOnce(httpError(401));

      await auth().restoreSession();

      expect(auth().isLoading).toBe(false);
      expect(auth().isAuthenticated).toBe(false);
      expect(mockSecureStore.has('refresh_token')).toBe(false);
    });
  });

  it('starts signed out when secure storage cannot be read', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keystore unavailable'));

    await auth().restoreSession();

    expect(auth().isAuthenticated).toBe(false);
    expect(auth().isLoading).toBe(false);
  });

  it('ignores a saved user that cannot be parsed', async () => {
    saveSession({ withUser: false });
    mockSecureStore.set('auth_user', '{not json');
    post.mockResolvedValueOnce(refreshed());

    await auth().restoreSession();

    expect(auth().user?.id).toBe('user-1');
  });
});

describe('admin role', () => {
  it('comes from app_metadata, which only the server can set', () => {
    auth().setSession({ ...serverUser, app_metadata: { role: 'admin' } }, 'a', 'r');
    expect(auth().isAdmin).toBe(true);
  });

  it('is not granted by user_metadata, which the user can edit', () => {
    auth().setSession(
      { ...serverUser, user_metadata: { username: 'nino', role: 'admin' } as { username: string } },
      'a',
      'r',
    );
    expect(auth().isAdmin).toBe(false);
  });

  it('survives a restart without a connection', async () => {
    mockSecureStore.set('access_token', 'access-1');
    mockSecureStore.set('refresh_token', 'refresh-1');
    mockSecureStore.set('auth_user', JSON.stringify({ ...storedUser, role: 'admin' }));
    post.mockRejectedValueOnce(networkError());

    await auth().restoreSession();

    expect(auth().isAdmin).toBe(true);
    expect(auth().user?.app_metadata).toEqual({ role: 'admin' });
  });
});

describe('setSession', () => {
  it('keeps the tokens and a minimal user on the device', async () => {
    auth().setSession({ ...serverUser, app_metadata: { role: 'admin' } }, 'access-9', 'refresh-9');
    await settle();

    expect(mockSecureStore.get('access_token')).toBe('access-9');
    expect(mockSecureStore.get('refresh_token')).toBe('refresh-9');
    expect(JSON.parse(mockSecureStore.get('auth_user') ?? 'null')).toEqual({
      id: 'user-1',
      email: 'nino@example.com',
      username: 'nino',
      full_name: 'Nino K',
      role: 'admin',
    });
    expect(auth().isAuthenticated).toBe(true);
  });

  it('does not clear the query cache (it also runs on every token refresh)', () => {
    auth().setSession(serverUser, 'a', 'r');
    expect(clearCache).not.toHaveBeenCalled();
  });
});

describe('clearSession', () => {
  it('removes the session from memory and from the device, and clears cached data', async () => {
    saveSession();
    mockSecureStore.set('push_token', 'ExponentPushToken[abc]');
    auth().setSession(serverUser, 'access-1', 'refresh-1');

    auth().clearSession();
    await settle();

    expect(auth()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isAdmin: false,
    });
    expect(mockSecureStore.has('access_token')).toBe(false);
    expect(mockSecureStore.has('refresh_token')).toBe(false);
    expect(mockSecureStore.has('auth_user')).toBe(false);
    expect(clearCache).toHaveBeenCalledTimes(1);
    // The push token belongs to the device; signing out deals with it separately
    expect(mockSecureStore.get('push_token')).toBe('ExponentPushToken[abc]');
  });
});

describe('refreshSession', () => {
  beforeEach(() => {
    auth().setSession(serverUser, 'access-1', 'refresh-1');
    jest.clearAllMocks();
  });

  it('shares one request between callers that overlap', async () => {
    let answer: (value: unknown) => void = () => {};
    post.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

    const first = refreshSession();
    const second = refreshSession();
    const third = refreshSession();
    answer(refreshed());

    expect(await Promise.all([first, second, third])).toEqual(['refreshed', 'refreshed', 'refreshed']);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('starts a new request once the previous one has finished', async () => {
    post.mockResolvedValueOnce(refreshed()).mockResolvedValueOnce(refreshed());

    await refreshSession();
    await refreshSession();

    expect(post).toHaveBeenCalledTimes(2);
    // The second one spends the token the first one returned
    expect(post.mock.calls[1][1]).toEqual({ refresh_token: 'refresh-2' });
  });

  it('reports failure and keeps the session on a network error', async () => {
    post.mockRejectedValueOnce(networkError());

    expect(await refreshSession()).toBe('failed');
    expect(auth().isAuthenticated).toBe(true);
    expect(auth().refreshToken).toBe('refresh-1');
  });

  it('reports sign-out on 401', async () => {
    post.mockRejectedValueOnce(httpError(401));

    expect(await refreshSession()).toBe('signed-out');
    expect(auth().isAuthenticated).toBe(false);
  });

  it('keeps the session when the answer has no tokens in it', async () => {
    post.mockResolvedValueOnce({ data: { user: serverUser, session: null } });

    expect(await refreshSession()).toBe('failed');
    expect(auth().accessToken).toBe('access-1');
  });

  it('does not bring a session back that was closed while the request was on its way', async () => {
    let answer: (value: unknown) => void = () => {};
    post.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

    const refreshing = refreshSession();
    auth().clearSession(); // the user signs out
    answer(refreshed());

    expect(await refreshing).toBe('failed');
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().accessToken).toBeNull();
  });

  it('does not close a new session because the old one was rejected', async () => {
    let reject: (reason: unknown) => void = () => {};
    post.mockReturnValueOnce(new Promise((_resolve, fail) => (reject = fail)));

    const refreshing = refreshSession();
    auth().setSession({ ...serverUser, id: 'user-2' }, 'access-other', 'refresh-other'); // someone else signs in
    reject(httpError(401));

    expect(await refreshing).toBe('failed');
    expect(auth().isAuthenticated).toBe(true);
    expect(auth().user?.id).toBe('user-2');
  });

  it('does nothing when nobody is signed in', async () => {
    auth().clearSession();
    jest.clearAllMocks();

    expect(await refreshSession()).toBe('failed');
    expect(post).not.toHaveBeenCalled();
  });
});
