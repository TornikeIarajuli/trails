import { haversineDistance } from './geo';
import { PendingCompletion, RecordHikePayload, TrackPoint } from '../types/completion';

/** One recorded position. `timestamp` is the time of the GPS fix in ms since epoch. */
export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface GpsFix extends GpsPoint {
  /** Reported horizontal accuracy in metres; null/undefined when the platform did not report one. */
  accuracy?: number | null;
}

/** Longest track kept on the phone for one hike. */
export const MAX_TRACK_POINTS = 20_000;
/** Longest track the API accepts (contract C1). */
export const MAX_UPLOAD_POINTS = 5_000;
/** Fixes with a worse reported accuracy than this are not recorded. */
export const MAX_FIX_ACCURACY_M = 50;
/** A fix closer than this to the previous recorded point is treated as the same position. */
export const MIN_POINT_DISTANCE_M = 3;

const CHECKIN_RADIUS_M = 30;
const CHECKIN_MAX_ACCURACY_SLACK_M = 10;

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** Coordinates are kept to 6 decimals (~0.1 m): far below GPS accuracy and a third of the storage. */
export function toGpsPoint(fix: GpsFix): GpsPoint {
  return { lat: round6(fix.lat), lng: round6(fix.lng), timestamp: fix.timestamp };
}

/**
 * Decides whether a fix extends the track. The foreground watcher and the
 * background task both deliver fixes, so the same one can arrive twice or out
 * of order; only a fix that is newer and at least a few metres away is kept.
 */
export function shouldRecordFix(previous: GpsPoint | undefined, fix: GpsFix): boolean {
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng) || !Number.isFinite(fix.timestamp)) {
    return false;
  }
  if (Math.abs(fix.lat) > 90 || Math.abs(fix.lng) > 180) return false;

  // iOS reports a negative accuracy for an invalid fix
  if (typeof fix.accuracy === 'number' && (fix.accuracy < 0 || fix.accuracy > MAX_FIX_ACCURACY_M)) {
    return false;
  }

  if (!previous) return true;
  if (fix.timestamp <= previous.timestamp) return false;
  return haversineDistance(previous.lat, previous.lng, fix.lat, fix.lng) >= MIN_POINT_DISTANCE_M;
}

/**
 * Makes room in a full track by dropping every other point of its older half.
 * The first and the most recent points always survive, so the start of the
 * hike is never lost — only its resolution.
 */
export function thinTrack<T>(points: T[], maxPoints: number = MAX_TRACK_POINTS): T[] {
  if (points.length < maxPoints || points.length < 4) return points;
  const half = Math.floor(points.length / 2);
  const thinned: T[] = [];
  for (let i = 0; i < half; i += 2) thinned.push(points[i]);
  for (let i = half; i < points.length; i++) thinned.push(points[i]);
  return thinned;
}

/** Evenly samples `points` down to at most `maxPoints`, always keeping the first and the last. */
export function downsampleTrack<T>(points: T[], maxPoints: number = MAX_UPLOAD_POINTS): T[] {
  if (maxPoints <= 0) return [];
  if (points.length <= maxPoints) return points;
  if (maxPoints === 1) return [points[points.length - 1]];
  const step = (points.length - 1) / (maxPoints - 1);
  const sampled: T[] = [];
  for (let i = 0; i < maxPoints; i++) sampled.push(points[Math.round(i * step)]);
  return sampled;
}

/** Converts a recorded track to the API format, downsampled to what the API accepts. */
export function toTrackPoints(points: GpsPoint[], maxPoints: number = MAX_UPLOAD_POINTS): TrackPoint[] {
  return downsampleTrack(points, maxPoints).map(
    (p): TrackPoint => [round6(p.lat), round6(p.lng), Math.round(p.timestamp / 1000)],
  );
}

/** Seconds the hike has been running, excluding paused time. */
export function computeElapsedSeconds(
  timing: { isPaused: boolean; resumedAt: number | null; baseElapsedSeconds: number },
  now: number = Date.now(),
): number {
  if (timing.isPaused || !timing.resumedAt) return timing.baseElapsedSeconds;
  return timing.baseElapsedSeconds + Math.max(0, Math.floor((now - timing.resumedAt) / 1000));
}

export function createLocalId(now: number = Date.now()): string {
  return `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface FinishedHikeSnapshot {
  trailId: string;
  startTime: number | null;
  isPaused: boolean;
  resumedAt: number | null;
  baseElapsedSeconds: number;
  distanceCoveredMeters: number;
  gpsPoints: GpsPoint[];
}

/** Freezes the hike that is being ended into the record that gets uploaded (now or later). */
export function buildPendingCompletion(
  hike: FinishedHikeSnapshot,
  userId: string | null,
  now: number = Date.now(),
): PendingCompletion {
  return {
    localId: createLocalId(now),
    userId,
    trailId: hike.trailId,
    elapsedSeconds: computeElapsedSeconds(hike, now),
    startedAt: hike.startTime ? new Date(hike.startTime).toISOString() : null,
    completedAt: new Date(now).toISOString(),
    distanceM: Math.round(hike.distanceCoveredMeters),
    track: toTrackPoints(hike.gpsPoints),
    attempts: 0,
  };
}

/** Request body for `POST /completions/record` (contract C1). Unknown values are left out. */
export function buildRecordHikePayload(completion: PendingCompletion): RecordHikePayload {
  const payload: RecordHikePayload = {
    trail_id: completion.trailId,
    elapsed_seconds: Math.max(0, Math.round(completion.elapsedSeconds)),
    completed_at: completion.completedAt,
  };
  if (completion.startedAt) payload.started_at = completion.startedAt;
  if (completion.distanceM != null) payload.distance_m = Math.max(0, Math.round(completion.distanceM));
  if (completion.track.length > 0) {
    payload.track =
      completion.track.length > MAX_UPLOAD_POINTS
        ? downsampleTrack(completion.track, MAX_UPLOAD_POINTS)
        : completion.track;
  }
  return payload;
}

/**
 * A checkpoint counts as reached within 30 m, widened by the fix's own
 * uncertainty up to 40 m. A fix too vague to be recorded cannot check in.
 */
export function isWithinCheckinRange(distanceM: number, accuracyM?: number | null): boolean {
  if (typeof accuracyM === 'number' && (accuracyM < 0 || accuracyM > MAX_FIX_ACCURACY_M)) return false;
  const slack = Math.min(accuracyM ?? 0, CHECKIN_MAX_ACCURACY_SLACK_M);
  return distanceM <= CHECKIN_RADIUS_M + slack;
}
