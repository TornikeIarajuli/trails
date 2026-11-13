/**
 * The API client's interceptors against a fake server (an axios adapter):
 * token refresh, who gets signed out and when, and which requests are retried.
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

import axios, { AxiosAdapter, AxiosError, InternalAxiosRequestConfig } from 'axios';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

type Reply = { status: number; data?: unknown } | 'network' | 'timeout' | 'cancel';
type Call = { method: string; path: string; bearer: string | null; timeout: number | undefined };

let calls: Call[] = [];
let respond: (call: Call, config: InternalAxiosRequestConfig) => Reply | Promise<Reply>;

const fakeServer: AxiosAdapter = async (config) => {
  const authorization = config.headers?.Authorization;
  const call: Call = {
    method: (config.method ?? 'get').toLowerCase(),
    path: (config.url ?? '').replace(/^https?:\/\/[^/]+\/api/, ''),
    bearer: typeof authorization === 'string' ? authorization.replace(/^Bearer /, '') : null,
    timeout: config.timeout,
  };
  calls.push(call);

  const reply = await respond(call, config);
  if (reply === 'network') throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
  if (reply === 'timeout') throw new AxiosError('timeout of 15000ms exceeded', AxiosError.ECONNABORTED, config);
  if (reply === 'cancel') throw new AxiosError('canceled', AxiosError.ERR_CANCELED, config);

  const response = { data: reply.data, status: reply.status, statusText: '', headers: {}, config };
  if (reply.status >= 200 && reply.status < 300) return response;
  throw new AxiosError(
    `Request failed with status code ${reply.status}`,
    AxiosError.ERR_BAD_RESPONSE,
    config,
    null,
    response,
  );
};

const user = { id: 'user-1', email: 'nino@example.com', user_metadata: { username: 'nino' } };
const newSession = (n = 2) => ({
  status: 200,
  data: { user, session: { access_token: `access-${n}`, refresh_token: `refresh-${n}`, expires_in: 3600 } },
});

const auth = () => useAuthStore.getState();
const to = (path: string) => calls.filter((c) => c.path === path);
const statusOf = (error: unknown) => (error as AxiosError).response?.status;
/** Rejection as a value, so a test can wait for it while fake timers are advanced. */
const failure = (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as AxiosError);

beforeAll(() => {
  api.defaults.adapter = fakeServer;
  axios.defaults.adapter = fakeServer; // the refresh call goes through plain axios
});

beforeEach(() => {
  calls = [];
  mockSecureStore.clear();
  auth().setSession(user, 'access-1', 'refresh-1');
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('authorization header', () => {
  it('sends the access token of the signed-in user', async () => {
    respond = () => ({ status: 200, data: [] });
    await api.get('/completions/me');
    expect(calls[0].bearer).toBe('access-1');
  });

  it('sends none when nobody is signed in', async () => {
    auth().clearSession();
    respond = () => ({ status: 200, data: [] });
    await api.get('/trails');
    expect(calls[0].bearer).toBeNull();
  });

  it('keeps a token given with the request when the session is already closed (sign-out)', async () => {
    auth().clearSession();
    respond = () => ({ status: 204 });
    await api.post('/auth/logout', undefined, { headers: { Authorization: 'Bearer closing-session' } });
    expect(calls[0].bearer).toBe('closing-session');
  });
});

describe('401 → refresh', () => {
  it('refreshes the session once and repeats the request with the new token', async () => {
    respond = (call) => {
      if (call.path === '/auth/refresh') return newSession();
      return call.bearer === 'access-2' ? { status: 200, data: { ok: true } } : { status: 401 };
    };

    const response = await api.get('/users/me');

    expect(response.data).toEqual({ ok: true });
    expect(to('/auth/refresh')).toHaveLength(1);
    expect(to('/users/me').map((c) => c.bearer)).toEqual(['access-1', 'access-2']);
    expect(auth().accessToken).toBe('access-2');
    expect(auth().refreshToken).toBe('refresh-2');
    expect(mockSecureStore.get('refresh_token')).toBe('refresh-2');
  });

  it('repeats a write too: the server rejected it before doing anything', async () => {
    respond = (call) => {
      if (call.path === '/auth/refresh') return newSession();
      return call.bearer === 'access-2' ? { status: 201, data: { id: 'c-1' } } : { status: 401 };
    };

    const response = await api.post('/completions/record', { trail_id: 't-1' });

    expect(response.data).toEqual({ id: 'c-1' });
    expect(to('/completions/record')).toHaveLength(2);
  });

  it('shares a single refresh between requests that fail at the same time', async () => {
    let releaseRefresh: () => void = () => {};
    const refreshGate = new Promise<void>((resolve) => (releaseRefresh = resolve));
    respond = async (call) => {
      if (call.path === '/auth/refresh') {
        await refreshGate;
        return newSession();
      }
      return call.bearer === 'access-2' ? { status: 200, data: call.path } : { status: 401 };
    };

    const all = Promise.all([api.get('/users/me'), api.get('/completions/me'), api.get('/badges/me'), api.get('/feed')]);
    await new Promise((resolve) => setImmediate(resolve));
    releaseRefresh();
    const responses = await all;

    expect(responses.map((r) => r.data)).toEqual(['/users/me', '/completions/me', '/badges/me', '/feed']);
    expect(to('/auth/refresh')).toHaveLength(1);
  });

  it('does not refresh again for a request that was sent before the refresh finished', async () => {
    let answerFirst: () => void = () => {};
    const firstAnswered = new Promise<void>((resolve) => (answerFirst = resolve));
    respond = async (call) => {
      if (call.bearer === 'access-2') return { status: 200, data: 'fresh' };
      await firstAnswered;
      return { status: 401 };
    };

    const pending = api.get('/users/me');
    await new Promise((resolve) => setImmediate(resolve));
    // Another request refreshed the session while this one was on its way
    auth().setSession(user, 'access-2', 'refresh-2');
    answerFirst();
    const response = await pending;

    expect(response.data).toBe('fresh');
    expect(to('/auth/refresh')).toHaveLength(0);
    expect(to('/users/me').map((c) => c.bearer)).toEqual(['access-1', 'access-2']);
  });

  it('gives up after one repeat instead of looping', async () => {
    respond = (call) => (call.path === '/auth/refresh' ? newSession() : { status: 401 });

    const error = await failure(api.get('/users/me'));

    expect(statusOf(error)).toBe(401);
    expect(to('/users/me')).toHaveLength(2);
    expect(to('/auth/refresh')).toHaveLength(1);
    // A 401 on a fresh token is about the request, not the session
    expect(auth().isAuthenticated).toBe(true);
  });

  it('puts a timeout on the refresh request', async () => {
    respond = (call) => {
      if (call.path === '/auth/refresh') return newSession();
      return call.bearer === 'access-2' ? { status: 200 } : { status: 401 };
    };

    await api.get('/users/me');

    expect(to('/auth/refresh')[0].timeout).toBeGreaterThan(0);
  });

  it('leaves a 401 alone when nobody is signed in (wrong password at login)', async () => {
    auth().clearSession();
    respond = () => ({ status: 401, data: { message: 'Invalid email or password' } });

    const error = await failure(api.post('/auth/login', { email: 'a@b.c', password: 'x' }));

    expect(statusOf(error)).toBe(401);
    expect(to('/auth/refresh')).toHaveLength(0);
    expect(to('/auth/login')).toHaveLength(1);
  });

  it('leaves a 401 alone when the request opts out of refreshing', async () => {
    respond = () => ({ status: 401 });

    const error = await failure(api.post('/auth/logout', undefined, { skipAuthRefresh: true }));

    expect(statusOf(error)).toBe(401);
    expect(to('/auth/refresh')).toHaveLength(0);
    expect(auth().isAuthenticated).toBe(true);
  });
});

describe('signing the user out', () => {
  it.each([401, 403])('happens when the refresh endpoint answers %i', async (status) => {
    const { queryClient } = jest.requireMock('../../utils/queryClient');
    respond = (call) => (call.path === '/auth/refresh' ? { status } : { status: 401 });

    const error = await failure(api.get('/users/me'));

    expect(statusOf(error)).toBe(401);
    expect(auth().isAuthenticated).toBe(false);
    expect(auth().accessToken).toBeNull();
    expect(mockSecureStore.has('refresh_token')).toBe(false);
    expect(queryClient.clear).toHaveBeenCalledTimes(1);
    expect(to('/users/me')).toHaveLength(1);
  });

  it.each([
    ['cannot be reached', 'network' as const],
    ['times out', 'timeout' as const],
    ['reports trouble upstream (503)', { status: 503 }],
    ['fails (500)', { status: 500 }],
    ['is rate limited (429)', { status: 429 }],
  ])('does NOT happen when the refresh endpoint %s', async (_name, reply) => {
    respond = (call) => (call.path === '/auth/refresh' ? reply : { status: 401 });

    const error = await failure(api.get('/users/me'));

    expect(statusOf(error)).toBe(401);
    expect(auth().isAuthenticated).toBe(true);
    expect(auth().accessToken).toBe('access-1');
    expect(auth().refreshToken).toBe('refresh-1');
    expect(mockSecureStore.get('refresh_token')).toBe('refresh-1');
    // The refresh itself is a POST and is not retried either
    expect(to('/auth/refresh')).toHaveLength(1);
  });
});

describe('automatic retries', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  });

  it.each(['get', 'head', 'options'] as const)('retries a %s twice after a network error', async (method) => {
    respond = () => 'network';

    const outcome = failure(api.request({ method, url: '/trails' }));
    await jest.runAllTimersAsync();
    const error = await outcome;

    expect(error?.code).toBe('ERR_NETWORK');
    expect(to('/trails')).toHaveLength(3);
  });

  it('waits a little longer before each retry', async () => {
    respond = () => 'timeout';

    const outcome = failure(api.get('/trails'));
    await jest.advanceTimersByTimeAsync(999);
    expect(to('/trails')).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(to('/trails')).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(1999);
    expect(to('/trails')).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(to('/trails')).toHaveLength(3);

    expect((await outcome)?.code).toBe('ECONNABORTED');
  });

  it('returns the answer when a retry succeeds', async () => {
    let attempt = 0;
    respond = () => (++attempt < 3 ? { status: 503 } : { status: 200, data: ['trail'] });

    const pending = api.get('/trails');
    await jest.runAllTimersAsync();

    expect((await pending).data).toEqual(['trail']);
    expect(to('/trails')).toHaveLength(3);
  });

  it.each([408, 500, 502, 503, 504])('retries a GET that got %i', async (status) => {
    respond = () => ({ status });

    const outcome = failure(api.get('/trails'));
    await jest.runAllTimersAsync();

    expect(statusOf(await outcome)).toBe(status);
    expect(to('/trails')).toHaveLength(3);
  });

  it('does not retry a rate-limited request', async () => {
    respond = () => ({ status: 429 });

    const outcome = failure(api.get('/trails'));
    await jest.runAllTimersAsync();

    expect(statusOf(await outcome)).toBe(429);
    expect(to('/trails')).toHaveLength(1);
  });

  it.each([400, 403, 404, 409, 422])('does not retry a GET that got %i', async (status) => {
    respond = () => ({ status });

    const outcome = failure(api.get('/trails/x'));
    await jest.runAllTimersAsync();

    expect(statusOf(await outcome)).toBe(status);
    expect(to('/trails/x')).toHaveLength(1);
  });

  it.each(['post', 'patch', 'put', 'delete'] as const)(
    'never retries a %s — not on a network error, a timeout or a server error',
    async (method) => {
      for (const reply of ['network', 'timeout', { status: 503 }, { status: 500 }] as Reply[]) {
        calls = [];
        respond = () => reply;

        const outcome = failure(api.request({ method, url: '/follows/user-2', data: {} }));
        await jest.runAllTimersAsync();
        await outcome;

        expect(to('/follows/user-2')).toHaveLength(1);
      }
    },
  );

  it('does not retry a request that was cancelled', async () => {
    respond = () => 'cancel';

    const outcome = failure(api.get('/trails'));
    await jest.runAllTimersAsync();

    expect((await outcome)?.code).toBe('ERR_CANCELED');
    expect(to('/trails')).toHaveLength(1);
  });
});
