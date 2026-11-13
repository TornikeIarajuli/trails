import { classifySyncFailure, entriesToSync, retryDelayMs, shouldSync } from '../../utils/syncQueue';
import { PendingCompletion } from '../../types/completion';

const entry = (localId: string, userId: string | null): PendingCompletion => ({
  localId,
  userId,
  trailId: 'trail-1',
  elapsedSeconds: 60,
  startedAt: null,
  completedAt: '2026-11-13T08:00:00.000Z',
  distanceM: null,
  track: [],
  attempts: 0,
});

const httpError = (status: number) => ({ isAxiosError: true, response: { status, data: {} } });

describe('classifySyncFailure', () => {
  it('keeps the entry when the server was never reached', () => {
    expect(classifySyncFailure({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' })).toBe('retry');
    expect(classifySyncFailure({ isAxiosError: true, code: 'ECONNABORTED', message: 'timeout of 60000ms exceeded' })).toBe('retry');
    expect(classifySyncFailure(new Error('anything else'))).toBe('retry');
    expect(classifySyncFailure(undefined)).toBe('retry');
  });

  it('keeps the entry on a server error', () => {
    for (const status of [500, 502, 503, 504]) expect(classifySyncFailure(httpError(status))).toBe('retry');
  });

  it('drops the entry when the server refuses it for good', () => {
    for (const status of [400, 404, 409, 410, 413, 422]) expect(classifySyncFailure(httpError(status))).toBe('drop');
  });

  it('keeps the entry when the problem is the session, the rate limit or a timeout', () => {
    for (const status of [401, 403, 408, 429]) expect(classifySyncFailure(httpError(status))).toBe('retry');
  });
});

describe('retryDelayMs', () => {
  it('starts at 15 seconds and doubles with every failed attempt', () => {
    expect([1, 2, 3, 4, 5].map(retryDelayMs)).toEqual([15_000, 30_000, 60_000, 120_000, 240_000]);
  });

  it('is capped at 15 minutes', () => {
    expect(retryDelayMs(7)).toBe(900_000);
    expect(retryDelayMs(50)).toBe(900_000);
    expect(retryDelayMs(100_000)).toBe(900_000);
  });

  it('treats a missing attempt count as the first attempt', () => {
    expect(retryDelayMs(0)).toBe(15_000);
    expect(retryDelayMs(-3)).toBe(15_000);
  });
});

describe('entriesToSync', () => {
  const queue = [entry('a', 'user-1'), entry('b', 'user-2'), entry('legacy', null), entry('c', 'user-1')];

  it("returns only the signed-in user's entries, oldest first", () => {
    expect(entriesToSync(queue, 'user-2').map((e) => e.localId)).toEqual(['b', 'legacy']);
  });

  it('gives an entry without an owner to whoever is signed in', () => {
    expect(entriesToSync(queue, 'user-1').map((e) => e.localId)).toEqual(['a', 'legacy', 'c']);
  });

  it('returns nothing when nobody is signed in', () => {
    expect(entriesToSync(queue, null)).toEqual([]);
    expect(entriesToSync(queue, undefined)).toEqual([]);
  });
});

describe('shouldSync', () => {
  const ready = { isOnline: true, isAuthenticated: true, userId: 'user-1', queue: [entry('a', 'user-1')] };

  it('runs when online, signed in and the user has something queued', () => {
    expect(shouldSync(ready)).toBe(true);
  });

  it('waits while offline', () => {
    expect(shouldSync({ ...ready, isOnline: false })).toBe(false);
  });

  it('waits until the session is restored', () => {
    expect(shouldSync({ ...ready, isAuthenticated: false })).toBe(false);
    expect(shouldSync({ ...ready, userId: null })).toBe(false);
  });

  it('does nothing when the queue only holds another account’s hikes', () => {
    expect(shouldSync({ ...ready, queue: [entry('b', 'user-2')] })).toBe(false);
    expect(shouldSync({ ...ready, queue: [] })).toBe(false);
  });
});
