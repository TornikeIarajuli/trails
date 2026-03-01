/**
 * HikeStore unit tests
 *
 * Strategy: manipulate store state directly via `setState` and `getState` —
 * no React renderer needed. AsyncStorage is auto-mocked via moduleNameMapper.
 *
 * Zustand v5 `setState(partial)` merges data fields while leaving action
 * functions intact. We reset only the data fields before each test.
 */
import { useHikeStore, GpsPoint } from '../../store/hikeStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const INITIAL_DATA = {
  isActive: false,
  trailId: null,
  startTime: null,
  elapsedSeconds: 0,
  isPaused: false,
  resumedAt: null,
  baseElapsedSeconds: 0,
  visitedCheckpointIds: [] as string[],
  gpsPoints: [] as GpsPoint[],
  lastHikeGpsPoints: [] as GpsPoint[],
};

const store = () => useHikeStore.getState();

beforeEach(() => {
  useHikeStore.setState(INITIAL_DATA);
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

  it('initialises resumedAt close to Date.now()', () => {
    const before = Date.now();
    store().startHike('t1');
    const { resumedAt } = store();
    expect(resumedAt).toBeGreaterThanOrEqual(before);
    expect(resumedAt).toBeLessThanOrEqual(Date.now());
  });

  it('clears any pre-existing gpsPoints', () => {
    useHikeStore.setState({ gpsPoints: [{ lat: 1, lng: 2, timestamp: 1000 }] });
    store().startHike('t1');
    expect(store().gpsPoints).toEqual([]);
  });

  it('clears any pre-existing visitedCheckpointIds', () => {
    useHikeStore.setState({ visitedCheckpointIds: ['cp-1', 'cp-2'] });
    store().startHike('t1');
    expect(store().visitedCheckpointIds).toEqual([]);
  });

  it('does not touch lastHikeGpsPoints (kept for export)', () => {
    const prev = [{ lat: 40.0, lng: 43.0, timestamp: 5000 }];
    useHikeStore.setState({ lastHikeGpsPoints: prev });
    store().startHike('t1');
    expect(store().lastHikeGpsPoints).toEqual(prev);
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

  it('clears trailId to null', () => {
    useHikeStore.setState({ trailId: 'trail-1' });
    store().endHike();
    expect(store().trailId).toBeNull();
  });

  it('resets elapsedSeconds, baseElapsedSeconds, and resumedAt', () => {
    useHikeStore.setState({ elapsedSeconds: 900, baseElapsedSeconds: 900, resumedAt: Date.now() });
    store().endHike();
    expect(store().elapsedSeconds).toBe(0);
    expect(store().baseElapsedSeconds).toBe(0);
    expect(store().resumedAt).toBeNull();
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

  it('preserves gpsPoints in lastHikeGpsPoints before clearing', () => {
    const points: GpsPoint[] = [
      { lat: 41.0, lng: 44.0, timestamp: 1000 },
      { lat: 41.1, lng: 44.1, timestamp: 2000 },
    ];
    useHikeStore.setState({ gpsPoints: points });
    store().endHike();
    expect(store().lastHikeGpsPoints).toEqual(points);
    expect(store().gpsPoints).toEqual([]);
  });

  it('overwrites any previous lastHikeGpsPoints', () => {
    const old: GpsPoint[] = [{ lat: 0, lng: 0, timestamp: 0 }];
    const fresh: GpsPoint[] = [{ lat: 42.0, lng: 45.0, timestamp: 9000 }];
    useHikeStore.setState({ lastHikeGpsPoints: old, gpsPoints: fresh });
    store().endHike();
    expect(store().lastHikeGpsPoints).toEqual(fresh);
  });

  it('sets isPaused back to false', () => {
    useHikeStore.setState({ isPaused: true });
    store().endHike();
    expect(store().isPaused).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addGpsPoint
// ---------------------------------------------------------------------------
describe('addGpsPoint', () => {
  it('appends a new point with correct lat, lng, and a timestamp', () => {
    useHikeStore.setState({ isPaused: false });
    const before = Date.now();
    store().addGpsPoint(41.5, 44.5);
    const { gpsPoints } = store();
    expect(gpsPoints).toHaveLength(1);
    expect(gpsPoints[0].lat).toBe(41.5);
    expect(gpsPoints[0].lng).toBe(44.5);
    expect(gpsPoints[0].timestamp).toBeGreaterThanOrEqual(before);
  });

  it('does not add a point when the hike is paused', () => {
    useHikeStore.setState({ isPaused: true, gpsPoints: [] });
    store().addGpsPoint(41.5, 44.5);
    expect(store().gpsPoints).toHaveLength(0);
  });

  it('accumulates multiple points in insertion order', () => {
    useHikeStore.setState({ isPaused: false, gpsPoints: [] });
    store().addGpsPoint(41.0, 44.0);
    store().addGpsPoint(41.1, 44.1);
    store().addGpsPoint(41.2, 44.2);
    const { gpsPoints } = store();
    expect(gpsPoints).toHaveLength(3);
    expect(gpsPoints[0].lat).toBe(41.0);
    expect(gpsPoints[2].lat).toBe(41.2);
  });

  it('caps the buffer at 500 entries — oldest point is dropped first', () => {
    const existing: GpsPoint[] = Array.from({ length: 500 }, (_, i) => ({
      lat: i,
      lng: i,
      timestamp: i * 1000,
    }));
    useHikeStore.setState({ isPaused: false, gpsPoints: existing });
    store().addGpsPoint(99.0, 99.0);
    const { gpsPoints } = store();
    expect(gpsPoints).toHaveLength(500);
    // Index 0 (lat=0) was the oldest and must have been removed
    expect(gpsPoints[0].lat).toBe(1);
    // The new point is at the end
    expect(gpsPoints[499].lat).toBe(99.0);
  });

  it('stays at exactly 500 after adding many points past the cap', () => {
    useHikeStore.setState({ isPaused: false, gpsPoints: [] });
    for (let i = 0; i < 510; i++) {
      store().addGpsPoint(i, i);
    }
    expect(store().gpsPoints).toHaveLength(500);
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

  it('can add the same checkpoint ID more than once (no deduplication)', () => {
    useHikeStore.setState({ visitedCheckpointIds: ['cp-1'] });
    store().markCheckpointVisited('cp-1');
    expect(store().visitedCheckpointIds).toHaveLength(2);
  });

  it('does not modify other state fields', () => {
    useHikeStore.setState({ gpsPoints: [{ lat: 1, lng: 2, timestamp: 1 }] });
    store().markCheckpointVisited('cp-x');
    expect(store().gpsPoints).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// clearLastHikeGps
// ---------------------------------------------------------------------------
describe('clearLastHikeGps', () => {
  it('empties the lastHikeGpsPoints array', () => {
    useHikeStore.setState({
      lastHikeGpsPoints: [{ lat: 1, lng: 2, timestamp: 1000 }],
    });
    store().clearLastHikeGps();
    expect(store().lastHikeGpsPoints).toEqual([]);
  });

  it('is a no-op when lastHikeGpsPoints is already empty', () => {
    useHikeStore.setState({ lastHikeGpsPoints: [] });
    store().clearLastHikeGps();
    expect(store().lastHikeGpsPoints).toEqual([]);
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
    useHikeStore.setState({ gpsPoints: [], resumedAt: Date.now() });
    store().addGpsPoint(41.0, 44.0); // active
    expect(store().gpsPoints).toHaveLength(1);

    store().pauseHike();
    store().addGpsPoint(41.1, 44.1); // paused — should NOT be added
    expect(store().gpsPoints).toHaveLength(1);

    store().resumeHike();
    store().addGpsPoint(41.2, 44.2); // active again
    expect(store().gpsPoints).toHaveLength(2);
  });
});
