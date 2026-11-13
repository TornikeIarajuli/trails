/**
 * The upload pass over the queue of hikes finished without a connection:
 * real hike store and decision logic, mocked network and session.
 */
const mockAuth = { isAuthenticated: true, user: { id: 'user-1' } as { id: string } | null };

jest.mock('../../services/completions', () => ({
  completionsService: { recordHike: jest.fn() },
}));
jest.mock('../../store/authStore', () => ({
  useAuthStore: { getState: () => mockAuth },
}));
jest.mock('../../utils/queryClient', () => ({
  queryClient: { invalidateQueries: jest.fn() },
}));

import { Alert } from 'react-native';
import { completionsService } from '../../services/completions';
import { useHikeStore, PendingCompletion, whenHikeStoreHydrated } from '../../store/hikeStore';
import { flushHikeStorage } from '../../utils/hikeStorage';
import { requestHikeSync, setHikeSyncOnline, uploadPendingHikes } from '../../utils/hikeSync';
import { queryClient } from '../../utils/queryClient';

const recordHike = completionsService.recordHike as jest.Mock;
const invalidateQueries = queryClient.invalidateQueries as jest.Mock;
const queue = () => useHikeStore.getState().pendingCompletions;

const entry = (localId: string, overrides: Partial<PendingCompletion> = {}): PendingCompletion => ({
  localId,
  userId: 'user-1',
  trailId: `trail-${localId}`,
  elapsedSeconds: 3600,
  startedAt: '2026-11-13T07:00:00.000Z',
  completedAt: '2026-11-13T08:00:00.000Z',
  distanceM: 5000,
  track: [[41, 44, 1_794_553_200]],
  attempts: 0,
  ...overrides,
});

const httpError = (status: number, message?: string) => ({
  isAxiosError: true,
  response: { status, data: { message } },
});
const networkError = () => ({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' });
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

let alertSpy: jest.SpyInstance;

beforeAll(async () => {
  await whenHikeStoreHydrated();
});

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockAuth.isAuthenticated = true;
  mockAuth.user = { id: 'user-1' };
  setHikeSyncOnline(true);
  useHikeStore.setState({ pendingCompletions: [], lastHike: null });
});

afterEach(async () => {
  jest.useRealTimers();
  alertSpy.mockRestore();
  await flushHikeStorage();
});

describe('uploadPendingHikes', () => {
  it('uploads the queued hikes in order with the contract payload and empties the queue', async () => {
    useHikeStore.setState({ pendingCompletions: [entry('a'), entry('b')] });
    recordHike.mockResolvedValueOnce({ id: 'completion-a' }).mockResolvedValueOnce({ id: 'completion-b' });

    const retryIn = await uploadPendingHikes();

    expect(retryIn).toBeNull();
    expect(recordHike).toHaveBeenCalledTimes(2);
    expect(recordHike.mock.calls[0][0]).toEqual({
      trail_id: 'trail-a',
      elapsed_seconds: 3600,
      started_at: '2026-11-13T07:00:00.000Z',
      completed_at: '2026-11-13T08:00:00.000Z',
      distance_m: 5000,
      track: [[41, 44, 1_794_553_200]],
    });
    expect(recordHike.mock.calls[1][0].trail_id).toBe('trail-b');
    expect(queue()).toEqual([]);
  });

  it('refreshes completions, profile, badges and the leaderboard after an upload', async () => {
    useHikeStore.setState({ pendingCompletions: [entry('a')] });
    recordHike.mockResolvedValueOnce({ id: 'completion-a' });

    await uploadPendingHikes();

    const invalidated = invalidateQueries.mock.calls.map(([arg]) => arg.queryKey[0]);
    expect(invalidated).toEqual(expect.arrayContaining(['completions', 'profile', 'badges', 'leaderboard']));
  });

  it('ties the saved track to the completion once its hike is uploaded', async () => {
    useHikeStore.setState({
      pendingCompletions: [entry('a')],
      lastHike: { trailId: 'trail-a', completionId: null, localId: 'a', points: [] },
    });
    recordHike.mockResolvedValueOnce({ id: 'completion-a' });

    await uploadPendingHikes();

    expect(useHikeStore.getState().lastHike?.completionId).toBe('completion-a');
  });

  it('keeps the hike and backs off when the server cannot be reached', async () => {
    useHikeStore.setState({ pendingCompletions: [entry('a'), entry('b')] });
    recordHike.mockRejectedValueOnce(networkError());

    const retryIn = await uploadPendingHikes();

    expect(retryIn).toBe(15_000);
    // The next entry would fail the same way, so it is not even tried
    expect(recordHike).toHaveBeenCalledTimes(1);
    expect(queue().map((e) => [e.localId, e.attempts])).toEqual([
      ['a', 1],
      ['b', 0],
    ]);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('waits longer after every failed attempt', async () => {
    useHikeStore.setState({ pendingCompletions: [entry('a', { attempts: 2 })] });
    recordHike.mockRejectedValueOnce(httpError(503));

    expect(await uploadPendingHikes()).toBe(60_000);
    expect(queue()[0].attempts).toBe(3);
  });

  it('removes a hike the server refuses, says so, and carries on with the next one', async () => {
    useHikeStore.setState({ pendingCompletions: [entry('a'), entry('b')] });
    recordHike
      .mockRejectedValueOnce(httpError(404, 'Trail not found'))
      .mockResolvedValueOnce({ id: 'completion-b' });

    const retryIn = await uploadPendingHikes();

    expect(retryIn).toBeNull();
    expect(queue()).toEqual([]);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][1]).toContain('Trail not found');
    expect(recordHike).toHaveBeenCalledTimes(2);
  });

  it('keeps the hike when the session has expired', async () => {
    useHikeStore.setState({ pendingCompletions: [entry('a')] });
    recordHike.mockRejectedValueOnce(httpError(401));

    expect(await uploadPendingHikes()).toBe(15_000);
    expect(queue()).toHaveLength(1);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('does nothing while offline', async () => {
    useHikeStore.setState({ pendingCompletions: [entry('a')] });
    setHikeSyncOnline(false);

    expect(await uploadPendingHikes()).toBeNull();
    expect(recordHike).not.toHaveBeenCalled();
    expect(queue()).toHaveLength(1);
  });

  it('does nothing until the session has been restored', async () => {
    useHikeStore.setState({ pendingCompletions: [entry('a')] });
    mockAuth.isAuthenticated = false;
    mockAuth.user = null;

    expect(await uploadPendingHikes()).toBeNull();
    expect(recordHike).not.toHaveBeenCalled();
  });

  it('never uploads a hike under another account', async () => {
    useHikeStore.setState({
      pendingCompletions: [entry('theirs', { userId: 'user-2' }), entry('mine')],
    });
    recordHike.mockResolvedValueOnce({ id: 'completion-mine' });

    await uploadPendingHikes();

    expect(recordHike).toHaveBeenCalledTimes(1);
    expect(recordHike.mock.calls[0][0].trail_id).toBe('trail-mine');
    expect(queue().map((e) => e.localId)).toEqual(['theirs']);
  });

  it('stops when the user signs out in the middle of a pass', async () => {
    useHikeStore.setState({ pendingCompletions: [entry('a'), entry('b')] });
    recordHike.mockImplementationOnce(async () => {
      mockAuth.isAuthenticated = false;
      mockAuth.user = null;
      return { id: 'completion-a' };
    });

    await uploadPendingHikes();

    expect(recordHike).toHaveBeenCalledTimes(1);
    expect(queue().map((e) => e.localId)).toEqual(['b']);
  });
});

describe('requestHikeSync', () => {
  it('retries by itself after the back-off delay', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
    useHikeStore.setState({ pendingCompletions: [entry('a')] });
    recordHike.mockRejectedValueOnce(networkError()).mockResolvedValueOnce({ id: 'completion-a' });

    requestHikeSync();
    await settle();
    expect(recordHike).toHaveBeenCalledTimes(1);
    expect(queue()).toHaveLength(1);

    jest.advanceTimersByTime(14_999);
    await settle();
    expect(recordHike).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1);
    await settle();
    expect(recordHike).toHaveBeenCalledTimes(2);
    expect(queue()).toEqual([]);
  });

  it('retries at once when asked again (app back in the foreground, connection back)', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
    useHikeStore.setState({ pendingCompletions: [entry('a')] });
    recordHike.mockRejectedValueOnce(networkError()).mockResolvedValueOnce({ id: 'completion-a' });

    requestHikeSync();
    await settle();
    requestHikeSync();
    await settle();

    expect(recordHike).toHaveBeenCalledTimes(2);
    expect(queue()).toEqual([]);

    // The timer of the failed attempt was cancelled: nothing fires later
    jest.advanceTimersByTime(60_000);
    await settle();
    expect(recordHike).toHaveBeenCalledTimes(2);
  });

  it('never runs two passes at the same time', async () => {
    useHikeStore.setState({ pendingCompletions: [entry('a')] });
    let finish: (value: { id: string }) => void = () => {};
    recordHike.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));

    requestHikeSync();
    requestHikeSync();
    requestHikeSync();
    await settle();
    expect(recordHike).toHaveBeenCalledTimes(1);

    finish({ id: 'completion-a' });
    await settle();
    expect(recordHike).toHaveBeenCalledTimes(1);
    expect(queue()).toEqual([]);
  });
});
