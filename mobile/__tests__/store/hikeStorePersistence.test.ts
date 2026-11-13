/**
 * How the hike store is saved and restored.
 *
 * AsyncStorage is the in-memory mock from moduleNameMapper, so these tests see
 * exactly which keys are written and when.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { useHikeStore, PendingCompletion, whenHikeStoreHydrated } from '../../store/hikeStore';
import { flushHikeStorage } from '../../utils/hikeStorage';

// Registered when utils/hikeStorage was imported; captured before any mock is cleared
const onAppStateChange = (AppState.addEventListener as jest.Mock).mock.calls[0][1] as (
  status: string,
) => void;

const multiSet = AsyncStorage.multiSet as jest.Mock;
const store = () => useHikeStore.getState();

const EMPTY = {
  isActive: false,
  trailId: null,
  ownerId: null,
  startTime: null,
  elapsedSeconds: 0,
  isPaused: false,
  resumedAt: null,
  baseElapsedSeconds: 0,
  visitedCheckpointIds: [] as string[],
  gpsPoints: [],
  distanceCoveredMeters: 0,
  lastHike: null,
  pendingCompletions: [] as PendingCompletion[],
};

const keysWritten = (): string[] =>
  multiSet.mock.calls.flatMap(([pairs]: [[string, string][]]) => pairs.map(([key]) => key));

const readStored = async (key: string) => {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
};

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

/** ~11 m further north per step, one second apart. */
const walk = (steps: number, from = 0) => {
  for (let i = from; i < from + steps; i++) {
    store().addGpsPoint(41 + i * 0.0001, 44, { timestamp: 1_000_000 + i * 1000, accuracy: 5 });
  }
};

const pending = (overrides: Partial<PendingCompletion> = {}): PendingCompletion => ({
  localId: 'local-1',
  userId: 'user-1',
  trailId: 'trail-a',
  elapsedSeconds: 3600,
  startedAt: '2026-11-13T07:00:00.000Z',
  completedAt: '2026-11-13T08:00:00.000Z',
  distanceM: 5000,
  track: [
    [41.0, 44.0, 1_794_553_200],
    [41.001, 44.001, 1_794_553_260],
  ],
  attempts: 0,
  ...overrides,
});

/** Starts each test from empty storage and an empty, fully loaded store. */
async function startClean() {
  await flushHikeStorage();
  await AsyncStorage.clear();
  await useHikeStore.persist.rehydrate();
  useHikeStore.setState(EMPTY);
  await flushHikeStorage();
  jest.clearAllMocks();
}

/** What a restart does: forget what is in memory and read storage again. */
async function restart() {
  await flushHikeStorage();
  useHikeStore.setState(EMPTY);
  await useHikeStore.persist.rehydrate();
}

beforeAll(async () => {
  await whenHikeStoreHydrated();
});

beforeEach(startClean);

afterEach(async () => {
  jest.useRealTimers();
  await flushHikeStorage();
});

describe('when the store writes', () => {
  it('does not write for timer ticks, and never stores elapsedSeconds', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
    store().startHike('trail-a');
    await flushHikeStorage();
    jest.clearAllMocks();

    jest.advanceTimersByTime(3000);
    store().tick();
    expect(store().elapsedSeconds).toBe(3);
    jest.advanceTimersByTime(60_000);
    store().tick();
    expect(store().elapsedSeconds).toBe(63);

    await flushHikeStorage();
    expect(multiSet).not.toHaveBeenCalled();
    expect((await readStored('hike-store')).state).not.toHaveProperty('elapsedSeconds');
  });

  it('collects GPS points and writes them at most every few seconds', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
    store().startHike('trail-a');
    await flushHikeStorage();
    jest.clearAllMocks();

    walk(3);
    await settle();
    expect(multiSet).not.toHaveBeenCalled();

    jest.advanceTimersByTime(4999);
    await settle();
    expect(multiSet).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await flushHikeStorage();
    expect(multiSet).toHaveBeenCalledTimes(1);
    expect(keysWritten()).toEqual(['hike-store:track:0', 'hike-store']);
    expect(await readStored('hike-store:track:0')).toHaveLength(3);
  });

  it('writes pause, resume and end right away', async () => {
    store().startHike('trail-a');
    await settle();
    expect((await readStored('hike-store')).state.isActive).toBe(true);

    store().pauseHike();
    await settle();
    expect((await readStored('hike-store')).state.isPaused).toBe(true);

    store().resumeHike();
    await settle();
    expect((await readStored('hike-store')).state.isPaused).toBe(false);

    store().endHike({ completionId: 'c-1' });
    await settle();
    expect((await readStored('hike-store')).state.isActive).toBe(false);
  });

  it('writes queue changes right away', async () => {
    store().enqueueCompletion(pending());
    await settle();
    expect((await readStored('hike-store')).state.pendingCompletions).toHaveLength(1);
    expect(await readStored('hike-store:queue:local-1')).toHaveLength(2);

    store().removePendingCompletion('local-1');
    await settle();
    expect((await readStored('hike-store')).state.pendingCompletions).toHaveLength(0);
    expect(await AsyncStorage.getItem('hike-store:queue:local-1')).toBeNull();
  });

  it('writes what is pending when the app goes to the background', async () => {
    store().startHike('trail-a');
    await flushHikeStorage();
    walk(2);
    expect(await AsyncStorage.getItem('hike-store:track:0')).toBeNull();

    onAppStateChange('background');
    await settle();
    expect(await readStored('hike-store:track:0')).toHaveLength(2);
  });

  it('rewrites only the last chunk of a long track', async () => {
    store().startHike('trail-a');
    walk(1200);
    await flushHikeStorage();
    expect((await readStored('hike-store')).state.trackChunks).toBe(3);
    jest.clearAllMocks();

    walk(1, 1200);
    await flushHikeStorage();

    expect(keysWritten()).toEqual(['hike-store:track:2', 'hike-store']);
    expect(await readStored('hike-store:track:2')).toHaveLength(201);
  });

  it('keeps the queued track out of the record that is rewritten on every flush', async () => {
    store().enqueueCompletion(pending());
    await flushHikeStorage();
    const main = await AsyncStorage.getItem('hike-store');
    expect(main).not.toContain('"track"');
  });

  it('removes the chunks of a finished hike', async () => {
    store().startHike('trail-a');
    walk(600);
    await flushHikeStorage();
    expect(await AsyncStorage.getItem('hike-store:track:1')).not.toBeNull();

    store().endHike({ completionId: 'c-1' });
    await flushHikeStorage();

    expect(await AsyncStorage.getItem('hike-store:track:0')).toBeNull();
    expect(await AsyncStorage.getItem('hike-store:track:1')).toBeNull();
    expect(await readStored('hike-store:last')).toHaveLength(600);
  });
});

describe('restoring after a restart', () => {
  it('brings back the active hike, the last hike and the queue with their tracks', async () => {
    store().startHike('trail-a');
    walk(2);
    const queued = pending();
    store().enqueueCompletion(queued);
    store().endHike({ localId: queued.localId });

    store().startHike('trail-b', 'user-9');
    walk(750, 10);
    store().markCheckpointVisited('cp-1');
    store().pauseHike();
    const before = store();

    await restart();

    const after = store();
    expect(after.isActive).toBe(true);
    expect(after.trailId).toBe('trail-b');
    expect(after.ownerId).toBe('user-9');
    expect(after.isPaused).toBe(true);
    expect(after.visitedCheckpointIds).toEqual(['cp-1']);
    expect(after.gpsPoints).toEqual(before.gpsPoints);
    expect(after.gpsPoints).toHaveLength(750);
    expect(after.distanceCoveredMeters).toBeCloseTo(before.distanceCoveredMeters, 3);
    expect(after.lastHike).toEqual({
      trailId: 'trail-a',
      completionId: null,
      localId: 'local-1',
      points: before.lastHike?.points,
    });
    expect(after.pendingCompletions).toEqual([queued]);
    // Paused: the elapsed time is exactly what had accumulated
    expect(after.elapsedSeconds).toBe(after.baseElapsedSeconds);
  });

  it('keeps appending to the right chunk after a restart', async () => {
    store().startHike('trail-a');
    walk(700);
    await restart();
    jest.clearAllMocks();

    walk(1, 700);
    await flushHikeStorage();

    expect(keysWritten()).toEqual(['hike-store:track:1', 'hike-store']);
    expect(await readStored('hike-store:track:1')).toHaveLength(201);
  });

  it('derives the elapsed time of a running hike from when it was resumed', async () => {
    await AsyncStorage.setItem(
      'hike-store',
      JSON.stringify({
        version: 1,
        state: {
          isActive: true,
          trailId: 'trail-a',
          startTime: Date.now() - 100_000,
          isPaused: false,
          resumedAt: Date.now() - 90_000,
          baseElapsedSeconds: 10,
          visitedCheckpointIds: [],
          distanceCoveredMeters: 0,
          trackChunks: 0,
          lastHike: null,
          pendingCompletions: [],
        },
      }),
    );

    await useHikeStore.persist.rehydrate();

    expect(store().elapsedSeconds).toBeGreaterThanOrEqual(99);
    expect(store().elapsedSeconds).toBeLessThanOrEqual(101);
  });

  it('does not let state set before loading overwrite the saved hike', async () => {
    store().startHike('trail-a');
    walk(3);
    await flushHikeStorage();

    const loading = useHikeStore.persist.rehydrate();
    // Runs before the saved state has been read back
    useHikeStore.setState({ isActive: false, trailId: null, gpsPoints: [] });
    await loading;
    await flushHikeStorage();

    expect(store().isActive).toBe(true);
    expect(store().gpsPoints).toHaveLength(3);
    expect((await readStored('hike-store')).state.isActive).toBe(true);
    expect(await readStored('hike-store:track:0')).toHaveLength(3);
  });

  it('clears sub-keys that the main record does not know about', async () => {
    store().startHike('trail-a');
    walk(2);
    await flushHikeStorage();
    await AsyncStorage.setItem('hike-store:queue:left-behind', '[]');
    await AsyncStorage.setItem('hike-store:track:7', '[]');
    await AsyncStorage.setItem('unrelated-key', 'keep me');

    await restart();
    await flushHikeStorage();

    expect(await AsyncStorage.getItem('hike-store:queue:left-behind')).toBeNull();
    expect(await AsyncStorage.getItem('hike-store:track:7')).toBeNull();
    expect(await AsyncStorage.getItem('hike-store:track:0')).not.toBeNull();
    expect(await AsyncStorage.getItem('unrelated-key')).toBe('keep me');
  });

  it('survives a missing track chunk and rewrites the track whole', async () => {
    store().startHike('trail-a');
    walk(1100);
    await flushHikeStorage();
    await AsyncStorage.removeItem('hike-store:track:1');

    await restart();
    expect(store().isActive).toBe(true);
    expect(store().gpsPoints).toHaveLength(600);

    await flushHikeStorage();
    expect((await readStored('hike-store')).state.trackChunks).toBe(2);
    expect(await readStored('hike-store:track:1')).toHaveLength(100);
    expect(await AsyncStorage.getItem('hike-store:track:2')).toBeNull();
  });
});

describe('migrating the old single-slot format', () => {
  const legacy = {
    version: 0,
    state: {
      isActive: true,
      trailId: 'trail-active',
      startTime: 1_700_000_000_000,
      elapsedSeconds: 999,
      isPaused: true,
      resumedAt: null,
      baseElapsedSeconds: 1200,
      visitedCheckpointIds: ['cp-1'],
      gpsPoints: [
        { lat: 41.0, lng: 44.0, timestamp: 1_700_000_000_000 },
        { lat: 41.001, lng: 44.001, timestamp: 1_700_000_010_000 },
      ],
      lastHikeGpsPoints: [{ lat: 42.0, lng: 45.0, timestamp: 1_600_000_000_000 }],
      distanceCoveredMeters: 140,
      pendingSync: { trailId: 'trail-pending', elapsedSeconds: 5400, completedAt: '2026-03-01T10:00:00.000Z' },
    },
  };

  it('turns pendingSync into a queue entry and keeps the active hike', async () => {
    await AsyncStorage.setItem('hike-store', JSON.stringify(legacy));

    await useHikeStore.persist.rehydrate();

    const state = store();
    expect(state.pendingCompletions).toHaveLength(1);
    expect(state.pendingCompletions[0]).toMatchObject({
      userId: null,
      trailId: 'trail-pending',
      elapsedSeconds: 5400,
      startedAt: null,
      completedAt: '2026-03-01T10:00:00.000Z',
      distanceM: null,
      track: [],
      attempts: 0,
    });
    expect(state.pendingCompletions[0].localId).toEqual(expect.any(String));

    expect(state.isActive).toBe(true);
    expect(state.trailId).toBe('trail-active');
    expect(state.ownerId).toBeNull();
    expect(state.gpsPoints).toEqual(legacy.state.gpsPoints);
    expect(state.visitedCheckpointIds).toEqual(['cp-1']);
    // Paused, so the stored (stale) elapsedSeconds is replaced by the accumulated time
    expect(state.elapsedSeconds).toBe(1200);
    // The old buffer was not tied to a trail, so it cannot be offered for export
    expect(state.lastHike).toBeNull();
  });

  it('rewrites storage in the current layout', async () => {
    await AsyncStorage.setItem('hike-store', JSON.stringify(legacy));

    await useHikeStore.persist.rehydrate();
    await flushHikeStorage();

    const main = await readStored('hike-store');
    expect(main.version).toBe(1);
    expect(main.state).not.toHaveProperty('pendingSync');
    expect(main.state).not.toHaveProperty('gpsPoints');
    expect(main.state.pendingCompletions).toHaveLength(1);
    expect(await readStored('hike-store:track:0')).toHaveLength(2);
  });

  it('starts empty when nothing was saved', async () => {
    await AsyncStorage.clear();
    await useHikeStore.persist.rehydrate();
    expect(store().isActive).toBe(false);
    expect(store().pendingCompletions).toEqual([]);
    expect(store()._hydrated).toBe(true);
  });
});
