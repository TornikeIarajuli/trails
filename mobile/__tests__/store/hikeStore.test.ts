/**
 * HikeStore unit tests
 *
 * Strategy: manipulate store state directly via `setState` and `getState` —
 * no React renderer needed. AsyncStorage is auto-mocked via moduleNameMapper.
 *
 * Zustand v5 `setState(partial)` merges data fields while leaving action
 * functions intact. We reset only the data fields before each test.
 */
import { useHikeStore, GpsPoint, PendingCompletion, whenHikeStoreHydrated } from '../../store/hikeStore';
import { flushHikeStorage } from '../../utils/hikeStorage';
import { MAX_TRACK_POINTS } from '../../utils/track';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const INITIAL_DATA = {
  isActive: false,
  trailId: null,
  ownerId: null,
  startTime: null,
  elapsedSeconds: 0,
  isPaused: false,
  resumedAt: null,
  baseElapsedSeconds: 0,
  visitedCheckpointIds: [] as string[],
  gpsPoints: [] as GpsPoint[],
  distanceCoveredMeters: 0,
  lastHike: null,
  pendingCompletions: [] as PendingCompletion[],
};

const store = () => useHikeStore.getState();

/** One degree of latitude is ~111 km, so 0.0001° is ~11 m. */
const METERS_11 = 0.0001;

const pending = (overrides: Partial<PendingCompletion> = {}): PendingCompletion => ({
  localId: 'local-1',
  userId: 'user-1',
  trailId: 'trail-1',
  elapsedSeconds: 3600,
  startedAt: '2026-11-13T07:00:00.000Z',
  completedAt: '2026-11-13T08:00:00.000Z',
  distanceM: 5000,
  track: [[41.0, 44.0, 1_794_553_200]],
  attempts: 0,
  ...overrides,
});

beforeAll(async () => {
  await whenHikeStoreHydrated();
});

beforeEach(() => {
  useHikeStore.setState(INITIAL_DATA);
});

// Actions schedule a write; let it finish so no timer outlives the test
afterEach(async () => {
  await flushHikeStorage();
});

// ---------------------------------------------------------------------------
// startHike
// ---------------------------------------------------------------------------
describe('startHike', () => {
  it('sets isActive to true', () => {
    store().startHike('trail-abc');
    expect(store().isActive).toBe(true);
  });

  it('records the given trailId', () => {
    store().startHike('trail-xyz');
    expect(store().trailId).toBe('trail-xyz');
  });

  it('records which account the hike belongs to', () => {
    store().startHike('trail-xyz', 'user-1');
    expect(store().ownerId).toBe('user-1');
  });

  it('has no owner when none is given', () => {
    useHikeStore.setState({ ownerId: 'someone-else' });
    store().startHike('trail-xyz');
    expect(store().ownerId).toBeNull();
  });

  it('resets elapsedSeconds and baseElapsedSeconds to 0', () => {
    useHikeStore.setState({ elapsedSeconds: 999, baseElapsedSeconds: 400 });
    store().startHike('t1');
    expect(store().elapsedSeconds).toBe(0);
    expect(store().baseElapsedSeconds).toBe(0);
  });

  it('sets isPaused to false', () => {
    useHikeStore.setState({ isPaused: true });
    store().startHike('t1');
    expect(store().isPaused).toBe(false);
  });

  it('initialises resumedAt and startTime close to Date.now()', () => {
    const before = Date.now();
    store().startHike('t1');
    const { resumedAt, startTime } = store();
    expect(resumedAt).toBeGreaterThanOrEqual(before);
    expect(resumedAt).toBeLessThanOrEqual(Date.now());
    expect(startTime).toBe(resumedAt);
  });

  it('clears any pre-existing gpsPoints and distance', () => {
    useHikeStore.setState({
      gpsPoints: [{ lat: 1, lng: 2, timestamp: 1000 }],
      distanceCoveredMeters: 1234,
    });
    store().startHike('t1');
    expect(store().gpsPoints).toEqual([]);
    expect(store().distanceCoveredMeters).toBe(0);
  });

  it('clears any pre-existing visitedCheckpointIds', () => {
    useHikeStore.setState({ visitedCheckpointIds: ['cp-1', 'cp-2'] });
    store().startHike('t1');
    expect(store().visitedCheckpointIds).toEqual([]);
  });

  it('does not touch lastHike (kept for export)', () => {
    const prev = {
      trailId: 'older-trail',
      completionId: 'c-1',
      localId: null,
      points: [{ lat: 40.0, lng: 43.0, timestamp: 5000 }],
    };
    useHikeStore.setState({ lastHike: prev });
    store().startHike('t1');
    expect(store().lastHike).toEqual(prev);
  });

  it('does not touch the queue of completions waiting to upload', () => {
    useHikeStore.setState({ pendingCompletions: [pending()] });
    store().startHike('t1');
    expect(store().pendingCompletions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// pauseHike
// ---------------------------------------------------------------------------
describe('pauseHike', () => {
  it('sets isPaused to true', () => {
    useHikeStore.setState({ resumedAt: Date.now(), baseElapsedSeconds: 0 });
    store().pauseHike();
    expect(store().isPaused).toBe(true);
  });

  it('clears resumedAt to null', () => {
    useHikeStore.setState({ resumedAt: Date.now() });
    store().pauseHike();
    expect(store().resumedAt).toBeNull();
  });

  it('accumulates the current running segment into baseElapsedSeconds', () => {
    const resumedAt = Date.now() - 30_000; // 30 s ago
    useHikeStore.setState({ resumedAt, baseElapsedSeconds: 10 });
    store().pauseHike();
    // 10 base + ~30 segment
    expect(store().baseElapsedSeconds).toBeGreaterThanOrEqual(39);
    expect(store().baseElapsedSeconds).toBeLessThanOrEqual(41);
  });

  it('adds 0 to baseElapsedSeconds when resumedAt is null', () => {
    useHikeStore.setState({ resumedAt: null, baseElapsedSeconds: 50 });
    store().pauseHike();
    expect(store().baseElapsedSeconds).toBe(50);
  });

  it('leaves elapsedSeconds unchanged', () => {
    useHikeStore.setState({ elapsedSeconds: 77, resumedAt: Date.now() });
    store().pauseHike();
    expect(store().elapsedSeconds).toBe(77);
  });
});

// ---------------------------------------------------------------------------
// resumeHike
// ---------------------------------------------------------------------------
describe('resumeHike', () => {
  it('sets isPaused to false', () => {
    useHikeStore.setState({ isPaused: true });
    store().resumeHike();
    expect(store().isPaused).toBe(false);
  });

  it('sets resumedAt close to Date.now()', () => {
    useHikeStore.setState({ isPaused: true, resumedAt: null });
    const before = Date.now();
    store().resumeHike();
    expect(store().resumedAt).toBeGreaterThanOrEqual(before);
    expect(store().resumedAt).toBeLessThanOrEqual(Date.now());
  });

  it('does not change baseElapsedSeconds', () => {
    useHikeStore.setState({ baseElapsedSeconds: 120, isPaused: true });
    store().resumeHike();
    expect(store().baseElapsedSeconds).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// tick
// ---------------------------------------------------------------------------
describe('tick', () => {
  it('updates elapsedSeconds when the hike is running (not paused)', () => {
    const resumedAt = Date.now() - 60_000; // 60 s ago
    useHikeStore.setState({ isPaused: false, resumedAt, baseElapsedSeconds: 0 });
    store().tick();
    expect(store().elapsedSeconds).toBeGreaterThanOrEqual(59);
    expect(store().elapsedSeconds).toBeLessThanOrEqual(61);
  });

  it('adds baseElapsedSeconds to the running segment', () => {
    const resumedAt = Date.now() - 10_000; // 10 s since resume
    useHikeStore.setState({ isPaused: false, resumedAt, baseElapsedSeconds: 120 });
    store().tick();
    expect(store().elapsedSeconds).toBeGreaterThanOrEqual(129);
    expect(store().elapsedSeconds).toBeLessThanOrEqual(131);
  });

  it('does NOT update elapsedSeconds when paused', () => {
    useHikeStore.setState({ isPaused: true, resumedAt: null, elapsedSeconds: 100 });
    store().tick();
    expect(store().elapsedSeconds).toBe(100);
  });

  it('does NOT update elapsedSeconds when resumedAt is null (hike not yet started)', () => {
    useHikeStore.setState({ isPaused: false, resumedAt: null, elapsedSeconds: 0 });
    store().tick();
    expect(store().elapsedSeconds).toBe(0);
  });

  it('successive ticks advance the counter', () => {
    const resumedAt = Date.now() - 5_000;
    useHikeStore.setState({ isPaused: false, resumedAt, baseElapsedSeconds: 0 });
    store().tick();
    const first = store().elapsedSeconds;
    // Simulate 2 more seconds passing
    useHikeStore.setState({ resumedAt: resumedAt - 2_000 });
    store().tick();
    const second = store().elapsedSeconds;
    expect(second).toBeGreaterThanOrEqual(first);
  });
});

// ---------------------------------------------------------------------------
// endHike
// ---------------------------------------------------------------------------
describe('endHike', () => {
  it('sets isActive to false', () => {
    useHikeStore.setState({ isActive: true });
    store().endHike();
    expect(store().isActive).toBe(false);
  });

  it('clears trailId and ownerId to null', () => {
    useHikeStore.setState({ trailId: 'trail-1', ownerId: 'user-1' });
    store().endHike();
    expect(store().trailId).toBeNull();
    expect(store().ownerId).toBeNull();
  });

  it('resets elapsedSeconds, baseElapsedSeconds, resumedAt and distance', () => {
    useHikeStore.setState({
      elapsedSeconds: 900,
      baseElapsedSeconds: 900,
      resumedAt: Date.now(),
      distanceCoveredMeters: 4200,
    });
    store().endHike();
    expect(store().elapsedSeconds).toBe(0);
    expect(store().baseElapsedSeconds).toBe(0);
    expect(store().resumedAt).toBeNull();
    expect(store().distanceCoveredMeters).toBe(0);
  });

  it('clears gpsPoints', () => {
    useHikeStore.setState({ gpsPoints: [{ lat: 41, lng: 44, timestamp: 1000 }] });
    store().endHike();
    expect(store().gpsPoints).toEqual([]);
  });

  it('clears visitedCheckpointIds', () => {
    useHikeStore.setState({ visitedCheckpointIds: ['cp-1', 'cp-2'] });
    store().endHike();
    expect(store().visitedCheckpointIds).toEqual([]);
  });

  it('keeps the track as lastHike, tied to the trail and the completion it produced', () => {
    const points: GpsPoint[] = [
      { lat: 41.0, lng: 44.0, timestamp: 1000 },
      { lat: 41.1, lng: 44.1, timestamp: 2000 },
    ];
    useHikeStore.setState({ isActive: true, trailId: 'trail-1', gpsPoints: points });
    store().endHike({ completionId: 'completion-9' });
    expect(store().lastHike).toEqual({
      trailId: 'trail-1',
      completionId: 'completion-9',
      localId: null,
      points,
    });
    expect(store().gpsPoints).toEqual([]);
  });

  it('ties the track to a queue entry when the hike could not be uploaded yet', () => {
    useHikeStore.setState({
      isActive: true,
      trailId: 'trail-1',
      gpsPoints: [{ lat: 41, lng: 44, timestamp: 1000 }],
    });
    store().endHike({ localId: 'local-7' });
    expect(store().lastHike).toMatchObject({ trailId: 'trail-1', completionId: null, localId: 'local-7' });
  });

  it('overwrites any previous lastHike', () => {
    const fresh: GpsPoint[] = [{ lat: 42.0, lng: 45.0, timestamp: 9000 }];
    useHikeStore.setState({
      lastHike: { trailId: 'old', completionId: 'c-old', localId: null, points: [{ lat: 0, lng: 0, timestamp: 0 }] },
      trailId: 'new',
      gpsPoints: fresh,
    });
    store().endHike();
    expect(store().lastHike?.trailId).toBe('new');
    expect(store().lastHike?.points).toEqual(fresh);
  });

  it('sets isPaused back to false', () => {
    useHikeStore.setState({ isPaused: true });
    store().endHike();
    expect(store().isPaused).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// discardHike
// ---------------------------------------------------------------------------
describe('discardHike', () => {
  it('resets the active hike and drops its track', () => {
    store().startHike('trail-1');
    store().addGpsPoint(41.0, 44.0, { timestamp: 1000 });
    store().discardHike();
    expect(store().isActive).toBe(false);
    expect(store().trailId).toBeNull();
    expect(store().gpsPoints).toEqual([]);
  });

  it('leaves the last finished hike alone', () => {
    const lastHike = {
      trailId: 'finished',
      completionId: 'c-1',
      localId: null,
      points: [{ lat: 41, lng: 44, timestamp: 1 }],
    };
    useHikeStore.setState({ lastHike });
    store().startHike('abandoned');
    store().addGpsPoint(42.0, 45.0, { timestamp: 1000 });
    store().discardHike();
    expect(store().lastHike).toEqual(lastHike);
  });

  it('keeps completions that are waiting to upload', () => {
    useHikeStore.setState({ pendingCompletions: [pending()] });
    store().startHike('abandoned');
    store().discardHike();
    expect(store().pendingCompletions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// addGpsPoint
// ---------------------------------------------------------------------------
describe('addGpsPoint', () => {
  beforeEach(() => {
    useHikeStore.setState({ isActive: true, isPaused: false });
  });

  it('appends a new point with the lat, lng and time of the fix', () => {
    const accepted = store().addGpsPoint(41.5, 44.5, { timestamp: 1_700_000_000_000, accuracy: 8 });
    const { gpsPoints } = store();
    expect(accepted).toBe(true);
    expect(gpsPoints).toEqual([{ lat: 41.5, lng: 44.5, timestamp: 1_700_000_000_000 }]);
  });

  it('falls back to the current time when the fix has no timestamp', () => {
    const before = Date.now();
    store().addGpsPoint(41.5, 44.5);
    expect(store().gpsPoints[0].timestamp).toBeGreaterThanOrEqual(before);
  });

  it('does not add a point when the hike is paused', () => {
    useHikeStore.setState({ isPaused: true });
    expect(store().addGpsPoint(41.5, 44.5, { timestamp: 1000 })).toBe(false);
    expect(store().gpsPoints).toHaveLength(0);
  });

  it('does not add a point when no hike is active', () => {
    useHikeStore.setState({ isActive: false });
    expect(store().addGpsPoint(41.5, 44.5, { timestamp: 1000 })).toBe(false);
    expect(store().gpsPoints).toHaveLength(0);
  });

  it('accumulates multiple points in insertion order', () => {
    store().addGpsPoint(41.0, 44.0, { timestamp: 1000 });
    store().addGpsPoint(41.1, 44.1, { timestamp: 2000 });
    store().addGpsPoint(41.2, 44.2, { timestamp: 3000 });
    const { gpsPoints } = store();
    expect(gpsPoints).toHaveLength(3);
    expect(gpsPoints[0].lat).toBe(41.0);
    expect(gpsPoints[2].lat).toBe(41.2);
  });

  it('drops a fix whose reported accuracy is worse than 50 m', () => {
    expect(store().addGpsPoint(41.0, 44.0, { timestamp: 1000, accuracy: 120 })).toBe(false);
    expect(store().addGpsPoint(41.0, 44.0, { timestamp: 2000, accuracy: 50 })).toBe(true);
    expect(store().gpsPoints).toHaveLength(1);
  });

  it('drops an invalid fix (negative accuracy)', () => {
    expect(store().addGpsPoint(41.0, 44.0, { timestamp: 1000, accuracy: -1 })).toBe(false);
  });

  it('ignores the same fix delivered twice (foreground watcher + background task)', () => {
    store().addGpsPoint(41.0, 44.0, { timestamp: 1000, accuracy: 5 });
    store().addGpsPoint(41.0 + METERS_11, 44.0, { timestamp: 2000, accuracy: 5 });
    const distance = store().distanceCoveredMeters;

    expect(store().addGpsPoint(41.0 + METERS_11, 44.0, { timestamp: 2000, accuracy: 5 })).toBe(false);
    expect(store().gpsPoints).toHaveLength(2);
    expect(store().distanceCoveredMeters).toBe(distance);
  });

  it('ignores a fix that is not newer than the last recorded one', () => {
    store().addGpsPoint(41.0, 44.0, { timestamp: 5000 });
    expect(store().addGpsPoint(41.0 + METERS_11, 44.0, { timestamp: 4000 })).toBe(false);
    expect(store().addGpsPoint(41.0 + METERS_11, 44.0, { timestamp: 5000 })).toBe(false);
    expect(store().gpsPoints).toHaveLength(1);
  });

  it('ignores a fix closer than ~3 m to the last recorded one', () => {
    store().addGpsPoint(41.0, 44.0, { timestamp: 1000 });
    // 0.00001° of latitude is ~1.1 m
    expect(store().addGpsPoint(41.00001, 44.0, { timestamp: 2000 })).toBe(false);
    expect(store().gpsPoints).toHaveLength(1);
    expect(store().distanceCoveredMeters).toBe(0);
  });

  it('adds the distance from the previous point', () => {
    store().addGpsPoint(41.0, 44.0, { timestamp: 1000 });
    store().addGpsPoint(41.0 + METERS_11, 44.0, { timestamp: 2000 });
    expect(store().distanceCoveredMeters).toBeGreaterThan(10);
    expect(store().distanceCoveredMeters).toBeLessThan(12);
  });

  it('keeps the whole track well past the old 500-point limit', () => {
    for (let i = 0; i < 510; i++) {
      store().addGpsPoint(41 + i * METERS_11, 44, { timestamp: 1000 + i });
    }
    const { gpsPoints } = store();
    expect(gpsPoints).toHaveLength(510);
    expect(gpsPoints[0].lat).toBe(41);
  });

  it('thins older points instead of dropping the start once the cap is reached', () => {
    const full: GpsPoint[] = Array.from({ length: MAX_TRACK_POINTS }, (_, i) => ({
      lat: 41 + i * METERS_11,
      lng: 44,
      timestamp: 1000 + i,
    }));
    useHikeStore.setState({ gpsPoints: full });

    store().addGpsPoint(50, 44, { timestamp: 10_000_000 });

    const { gpsPoints } = store();
    expect(gpsPoints.length).toBeLessThan(MAX_TRACK_POINTS);
    expect(gpsPoints[0]).toEqual(full[0]);
    expect(gpsPoints[gpsPoints.length - 2]).toEqual(full[full.length - 1]);
    expect(gpsPoints[gpsPoints.length - 1].lat).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// markCheckpointVisited
// ---------------------------------------------------------------------------
describe('markCheckpointVisited', () => {
  it('appends the checkpoint ID to visitedCheckpointIds', () => {
    useHikeStore.setState({ visitedCheckpointIds: [] });
    store().markCheckpointVisited('cp-1');
    store().markCheckpointVisited('cp-2');
    expect(store().visitedCheckpointIds).toEqual(['cp-1', 'cp-2']);
  });

  it('records a checkpoint only once', () => {
    useHikeStore.setState({ visitedCheckpointIds: ['cp-1'] });
    store().markCheckpointVisited('cp-1');
    expect(store().visitedCheckpointIds).toEqual(['cp-1']);
  });

  it('does not modify other state fields', () => {
    useHikeStore.setState({ gpsPoints: [{ lat: 1, lng: 2, timestamp: 1 }] });
    store().markCheckpointVisited('cp-x');
    expect(store().gpsPoints).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Queue of completions waiting to upload
// ---------------------------------------------------------------------------
describe('pending completions', () => {
  it('enqueueCompletion appends in order', () => {
    store().enqueueCompletion(pending({ localId: 'a' }));
    store().enqueueCompletion(pending({ localId: 'b' }));
    expect(store().pendingCompletions.map((p) => p.localId)).toEqual(['a', 'b']);
  });

  it('notePendingAttempt counts a failed attempt for that entry only', () => {
    useHikeStore.setState({ pendingCompletions: [pending({ localId: 'a' }), pending({ localId: 'b' })] });
    store().notePendingAttempt('b');
    store().notePendingAttempt('b');
    expect(store().pendingCompletions.map((p) => p.attempts)).toEqual([0, 2]);
  });

  it('removePendingCompletion drops the entry', () => {
    useHikeStore.setState({ pendingCompletions: [pending({ localId: 'a' }), pending({ localId: 'b' })] });
    store().removePendingCompletion('a');
    expect(store().pendingCompletions.map((p) => p.localId)).toEqual(['b']);
  });

  it('resolvePendingCompletion drops the entry and ties the saved track to the completion', () => {
    useHikeStore.setState({
      pendingCompletions: [pending({ localId: 'a' })],
      lastHike: { trailId: 'trail-1', completionId: null, localId: 'a', points: [{ lat: 41, lng: 44, timestamp: 1 }] },
    });
    store().resolvePendingCompletion('a', 'completion-5');
    expect(store().pendingCompletions).toEqual([]);
    expect(store().lastHike?.completionId).toBe('completion-5');
  });

  it('resolvePendingCompletion leaves the track of a different hike alone', () => {
    useHikeStore.setState({
      pendingCompletions: [pending({ localId: 'a' })],
      lastHike: { trailId: 'other', completionId: null, localId: 'b', points: [] },
    });
    store().resolvePendingCompletion('a', 'completion-5');
    expect(store().lastHike?.completionId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Pause / resume cycle — accumulated time
// ---------------------------------------------------------------------------
describe('pause ↔ resume cycle', () => {
  it('correctly accumulates time across two pause/resume cycles', () => {
    // Cycle 1: hike for ~60 s, then pause
    useHikeStore.setState({ resumedAt: Date.now() - 60_000, baseElapsedSeconds: 0 });
    store().pauseHike();
    const after1stPause = store().baseElapsedSeconds;
    expect(after1stPause).toBeGreaterThanOrEqual(59);

    // Cycle 2: resume, hike for ~30 s, then pause again
    store().resumeHike();
    useHikeStore.setState({ resumedAt: Date.now() - 30_000 });
    store().pauseHike();
    const after2ndPause = store().baseElapsedSeconds;
    expect(after2ndPause).toBeGreaterThanOrEqual(after1stPause + 29);
    expect(after2ndPause).toBeLessThanOrEqual(after1stPause + 31);
  });

  it('addGpsPoint is a no-op during the paused window', () => {
    useHikeStore.setState({ isActive: true, gpsPoints: [], resumedAt: Date.now() });
    store().addGpsPoint(41.0, 44.0, { timestamp: 1000 }); // active
    expect(store().gpsPoints).toHaveLength(1);

    store().pauseHike();
    store().addGpsPoint(41.1, 44.1, { timestamp: 2000 }); // paused — should NOT be added
    expect(store().gpsPoints).toHaveLength(1);

    store().resumeHike();
    store().addGpsPoint(41.2, 44.2, { timestamp: 3000 }); // active again
    expect(store().gpsPoints).toHaveLength(2);
  });
});
