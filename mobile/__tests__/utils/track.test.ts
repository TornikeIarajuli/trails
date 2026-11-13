import {
  GpsPoint,
  MAX_FIX_ACCURACY_M,
  MAX_TRACK_POINTS,
  MAX_UPLOAD_POINTS,
  buildPendingCompletion,
  buildRecordHikePayload,
  computeElapsedSeconds,
  downsampleTrack,
  isWithinCheckinRange,
  shouldRecordFix,
  thinTrack,
  toGpsPoint,
  toTrackPoints,
} from '../../utils/track';
import { PendingCompletion } from '../../types/completion';

const point = (i: number): GpsPoint => ({ lat: 41 + i * 0.0001, lng: 44, timestamp: 1_000_000 + i * 1000 });
const track = (n: number): GpsPoint[] => Array.from({ length: n }, (_, i) => point(i));

// ---------------------------------------------------------------------------
// shouldRecordFix
// ---------------------------------------------------------------------------
describe('shouldRecordFix', () => {
  const previous: GpsPoint = { lat: 41, lng: 44, timestamp: 10_000 };
  const moved = { lat: 41.0001, lng: 44, timestamp: 11_000 }; // ~11 m north, 1 s later

  it('accepts the first fix of a hike', () => {
    expect(shouldRecordFix(undefined, { lat: 41, lng: 44, timestamp: 1 })).toBe(true);
  });

  it('accepts a newer fix a few metres away', () => {
    expect(shouldRecordFix(previous, moved)).toBe(true);
  });

  it('accepts a fix with unknown accuracy', () => {
    expect(shouldRecordFix(previous, { ...moved, accuracy: null })).toBe(true);
    expect(shouldRecordFix(previous, { ...moved, accuracy: undefined })).toBe(true);
  });

  it(`rejects a fix less accurate than ${MAX_FIX_ACCURACY_M} m`, () => {
    expect(shouldRecordFix(previous, { ...moved, accuracy: MAX_FIX_ACCURACY_M })).toBe(true);
    expect(shouldRecordFix(previous, { ...moved, accuracy: MAX_FIX_ACCURACY_M + 0.1 })).toBe(false);
    expect(shouldRecordFix(undefined, { ...moved, accuracy: 1500 })).toBe(false);
  });

  it('rejects the negative accuracy iOS reports for an invalid fix', () => {
    expect(shouldRecordFix(previous, { ...moved, accuracy: -1 })).toBe(false);
  });

  it('rejects a fix that is older than or as old as the previous point', () => {
    expect(shouldRecordFix(previous, { ...moved, timestamp: 9_999 })).toBe(false);
    expect(shouldRecordFix(previous, { ...moved, timestamp: 10_000 })).toBe(false);
  });

  it('rejects a fix within ~3 m of the previous point', () => {
    // 0.00001° of latitude is ~1.1 m; 0.00003° is ~3.3 m
    expect(shouldRecordFix(previous, { lat: 41.00001, lng: 44, timestamp: 11_000 })).toBe(false);
    expect(shouldRecordFix(previous, { lat: 41.00003, lng: 44, timestamp: 11_000 })).toBe(true);
  });

  it('rejects coordinates that are not real positions', () => {
    expect(shouldRecordFix(undefined, { lat: NaN, lng: 44, timestamp: 1 })).toBe(false);
    expect(shouldRecordFix(undefined, { lat: 91, lng: 44, timestamp: 1 })).toBe(false);
    expect(shouldRecordFix(undefined, { lat: 41, lng: 181, timestamp: 1 })).toBe(false);
    expect(shouldRecordFix(undefined, { lat: 41, lng: 44, timestamp: NaN })).toBe(false);
  });
});

describe('toGpsPoint', () => {
  it('keeps 6 decimals of the coordinates and drops the accuracy', () => {
    expect(toGpsPoint({ lat: 41.123456789, lng: 44.987654321, timestamp: 5, accuracy: 7 })).toEqual({
      lat: 41.123457,
      lng: 44.987654,
      timestamp: 5,
    });
  });
});

// ---------------------------------------------------------------------------
// thinTrack
// ---------------------------------------------------------------------------
describe('thinTrack', () => {
  it('returns the same array while there is room', () => {
    const points = track(100);
    expect(thinTrack(points, 200)).toBe(points);
  });

  it('halves the older half and keeps the recent half intact', () => {
    const points = track(1000);
    const thinned = thinTrack(points, 1000);
    expect(thinned).toHaveLength(750);
    expect(thinned.slice(250)).toEqual(points.slice(500));
    expect(thinned[1]).toBe(points[2]);
  });

  it('never drops the start or the most recent point', () => {
    const points = track(MAX_TRACK_POINTS);
    const thinned = thinTrack(points);
    expect(thinned[0]).toBe(points[0]);
    expect(thinned[thinned.length - 1]).toBe(points[points.length - 1]);
    expect(thinned.length).toBeLessThan(MAX_TRACK_POINTS);
  });

  it('keeps points in chronological order', () => {
    const thinned = thinTrack(track(999), 999);
    for (let i = 1; i < thinned.length; i++) {
      expect(thinned[i].timestamp).toBeGreaterThan(thinned[i - 1].timestamp);
    }
  });

  it('stays bounded when applied every time the cap is reached', () => {
    let points: GpsPoint[] = [];
    for (let i = 0; i < 5000; i++) points = [...thinTrack(points, 400), point(i)];
    expect(points.length).toBeLessThanOrEqual(400);
    expect(points[0]).toEqual(point(0));
    expect(points[points.length - 1]).toEqual(point(4999));
  });
});

// ---------------------------------------------------------------------------
// downsampleTrack
// ---------------------------------------------------------------------------
describe('downsampleTrack', () => {
  it('returns the same array when it already fits', () => {
    const points = track(50);
    expect(downsampleTrack(points, 50)).toBe(points);
    expect(downsampleTrack(points, 500)).toBe(points);
  });

  it('reduces a long track to exactly the limit', () => {
    expect(downsampleTrack(track(12_345), MAX_UPLOAD_POINTS)).toHaveLength(MAX_UPLOAD_POINTS);
    expect(downsampleTrack(track(MAX_UPLOAD_POINTS + 1), MAX_UPLOAD_POINTS)).toHaveLength(MAX_UPLOAD_POINTS);
  });

  it('always keeps the first and the last point', () => {
    const points = track(20_000);
    const sampled = downsampleTrack(points, MAX_UPLOAD_POINTS);
    expect(sampled[0]).toBe(points[0]);
    expect(sampled[sampled.length - 1]).toBe(points[points.length - 1]);
  });

  it('samples evenly, without repeating or reordering points', () => {
    const points = track(20_000);
    const sampled = downsampleTrack(points, MAX_UPLOAD_POINTS);
    const gaps = sampled.slice(1).map((p, i) => (p.timestamp - sampled[i].timestamp) / 1000);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(5);
  });

  it('handles tiny limits', () => {
    const points = track(10);
    expect(downsampleTrack(points, 2)).toEqual([points[0], points[9]]);
    expect(downsampleTrack(points, 1)).toEqual([points[9]]);
    expect(downsampleTrack(points, 0)).toEqual([]);
    expect(downsampleTrack([], 5)).toEqual([]);
  });
});

describe('toTrackPoints', () => {
  it('converts to [lat, lng, unixSeconds]', () => {
    expect(toTrackPoints([{ lat: 42.6655, lng: 44.6146, timestamp: 1_794_553_200_400 }])).toEqual([
      [42.6655, 44.6146, 1_794_553_200],
    ]);
  });

  it('never returns more points than the API accepts', () => {
    const sent = toTrackPoints(track(MAX_TRACK_POINTS));
    expect(sent).toHaveLength(MAX_UPLOAD_POINTS);
    expect(sent[0]).toEqual([41, 44, 1000]);
    expect(sent[sent.length - 1][2]).toBe(1000 + MAX_TRACK_POINTS - 1);
  });
});

// ---------------------------------------------------------------------------
// computeElapsedSeconds
// ---------------------------------------------------------------------------
describe('computeElapsedSeconds', () => {
  it('adds the running segment to the accumulated time', () => {
    expect(computeElapsedSeconds({ isPaused: false, resumedAt: 10_000, baseElapsedSeconds: 30 }, 25_900)).toBe(45);
  });

  it('is the accumulated time while paused or not started', () => {
    expect(computeElapsedSeconds({ isPaused: true, resumedAt: 10_000, baseElapsedSeconds: 30 }, 99_000)).toBe(30);
    expect(computeElapsedSeconds({ isPaused: false, resumedAt: null, baseElapsedSeconds: 30 }, 99_000)).toBe(30);
  });

  it('never goes backwards when the clock was set back', () => {
    expect(computeElapsedSeconds({ isPaused: false, resumedAt: 10_000, baseElapsedSeconds: 30 }, 5_000)).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// buildPendingCompletion + buildRecordHikePayload (contract C1)
// ---------------------------------------------------------------------------
describe('buildPendingCompletion', () => {
  const now = Date.UTC(2026, 10, 13, 8, 30, 0);
  const hike = {
    trailId: 'trail-active',
    startTime: Date.UTC(2026, 10, 13, 7, 0, 0),
    isPaused: false,
    resumedAt: now - 600_000,
    baseElapsedSeconds: 4800,
    distanceCoveredMeters: 6120.4,
    gpsPoints: track(3),
  };

  it('freezes the hike under the stored trail id', () => {
    const completion = buildPendingCompletion(hike, 'user-1', now);
    expect(completion).toMatchObject({
      userId: 'user-1',
      trailId: 'trail-active',
      elapsedSeconds: 5400,
      startedAt: '2026-11-13T07:00:00.000Z',
      completedAt: '2026-11-13T08:30:00.000Z',
      distanceM: 6120,
      attempts: 0,
    });
    expect(completion.track).toEqual([
      [41, 44, 1000],
      [41.0001, 44, 1001],
      [41.0002, 44, 1002],
    ]);
  });

  it('gives every completion its own local id', () => {
    const a = buildPendingCompletion(hike, 'user-1', now);
    const b = buildPendingCompletion(hike, 'user-1', now);
    expect(a.localId).not.toBe(b.localId);
  });

  it('uses the accumulated time for a paused hike', () => {
    const completion = buildPendingCompletion({ ...hike, isPaused: true, resumedAt: null }, null, now);
    expect(completion.elapsedSeconds).toBe(4800);
    expect(completion.userId).toBeNull();
  });

  it('downsamples a long track to what the API accepts', () => {
    const completion = buildPendingCompletion({ ...hike, gpsPoints: track(MAX_TRACK_POINTS) }, 'user-1', now);
    expect(completion.track).toHaveLength(MAX_UPLOAD_POINTS);
  });
});

describe('buildRecordHikePayload', () => {
  const completion: PendingCompletion = {
    localId: 'local-1',
    userId: 'user-1',
    trailId: 'trail-1',
    elapsedSeconds: 5400,
    startedAt: '2026-11-13T07:00:00.000Z',
    completedAt: '2026-11-13T08:30:00.000Z',
    distanceM: 6120,
    track: [
      [42.6655, 44.6146, 1_794_553_200],
      [42.6656, 44.6147, 1_794_553_210],
    ],
    attempts: 3,
  };

  it('produces the request body of the contract', () => {
    expect(buildRecordHikePayload(completion)).toEqual({
      trail_id: 'trail-1',
      elapsed_seconds: 5400,
      started_at: '2026-11-13T07:00:00.000Z',
      completed_at: '2026-11-13T08:30:00.000Z',
      distance_m: 6120,
      track: [
        [42.6655, 44.6146, 1_794_553_200],
        [42.6656, 44.6147, 1_794_553_210],
      ],
    });
  });

  it('sends nothing that only matters on the phone', () => {
    const payload = buildRecordHikePayload(completion) as unknown as Record<string, unknown>;
    expect(payload).not.toHaveProperty('localId');
    expect(payload).not.toHaveProperty('userId');
    expect(payload).not.toHaveProperty('attempts');
  });

  it('leaves out what is unknown (an entry migrated from the old format)', () => {
    const payload = buildRecordHikePayload({ ...completion, startedAt: null, distanceM: null, track: [] });
    expect(payload).toEqual({
      trail_id: 'trail-1',
      elapsed_seconds: 5400,
      completed_at: '2026-11-13T08:30:00.000Z',
    });
  });

  it('sends whole, non-negative numbers', () => {
    const payload = buildRecordHikePayload({ ...completion, elapsedSeconds: -4.2, distanceM: 99.6 });
    expect(payload.elapsed_seconds).toBe(0);
    expect(payload.distance_m).toBe(100);
  });

  it('never sends more than 5000 points even if the stored entry has more', () => {
    const long = Array.from({ length: 7000 }, (_, i): [number, number, number] => [41 + i * 0.0001, 44, i]);
    const payload = buildRecordHikePayload({ ...completion, track: long });
    expect(payload.track).toHaveLength(MAX_UPLOAD_POINTS);
    expect(payload.track?.[0]).toEqual(long[0]);
    expect(payload.track?.[MAX_UPLOAD_POINTS - 1]).toEqual(long[6999]);
  });
});

// ---------------------------------------------------------------------------
// isWithinCheckinRange
// ---------------------------------------------------------------------------
describe('isWithinCheckinRange', () => {
  it('checks in within 30 m whatever the accuracy', () => {
    expect(isWithinCheckinRange(30, 0)).toBe(true);
    expect(isWithinCheckinRange(29, null)).toBe(true);
    expect(isWithinCheckinRange(31, null)).toBe(false);
  });

  it('widens the radius by the uncertainty of the fix, up to 40 m', () => {
    expect(isWithinCheckinRange(35, 5)).toBe(true);
    expect(isWithinCheckinRange(36, 5)).toBe(false);
    expect(isWithinCheckinRange(40, 25)).toBe(true);
    expect(isWithinCheckinRange(41, 25)).toBe(false);
  });

  it('does not check in on a fix too vague to be recorded', () => {
    expect(isWithinCheckinRange(5, MAX_FIX_ACCURACY_M + 1)).toBe(false);
    expect(isWithinCheckinRange(5, -1)).toBe(false);
  });
});
