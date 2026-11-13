import {
  CompletionSource,
  CompletionStatus,
  PastHikeResponse,
  RecordHikeResponse,
  TrailCompletion,
} from '../types/completion';
import { formatDate } from './formatters';
import { getErrorMessage, getErrorStatus } from './showError';

/**
 * Past hikes: a trail the user hiked before they had the app, marked as done by
 * themselves. Only the year is known (the server stores 1 January of that year at
 * 12:00 UTC), so no date, time or duration is ever shown for one.
 */

export const MIN_PAST_HIKE_YEAR = 1950;
/** Years offered as chips before "Earlier…": this year and the six before it. */
export const RECENT_PAST_HIKE_YEARS = 7;

type SourceLike = { source?: CompletionSource | string | null };
type CompletionLike = SourceLike & { completed_at: string };

/** A completion's source; older servers send none, which means a recorded hike. */
export function completionSource(completion: SourceLike): CompletionSource {
  return completion.source === 'past' || completion.source === 'photo' ? completion.source : 'hike';
}

export function isPastHike(completion: SourceLike | null | undefined): boolean {
  return completion?.source === 'past';
}

/** The year a past hike was marked for (the server may send "2019-01-01T12:00:00+00:00"). */
export function pastHikeYear(completion: { completed_at: string }): number | null {
  const date = new Date(completion.completed_at);
  return Number.isNaN(date.getTime()) ? null : date.getUTCFullYear();
}

/** "Hiked in 2019 · before the app" for a past hike, the completion date otherwise. */
export function completionDateLabel(completion: CompletionLike): string {
  if (!isPastHike(completion)) return formatDate(completion.completed_at);
  const year = pastHikeYear(completion);
  return year ? `Hiked in ${year} · before the app` : 'Hiked before the app';
}

/**
 * Years the user can pick: `recent` as chips, `earlier` behind "Earlier…".
 * The server accepts 1950 up to its current year, so the year is taken in UTC.
 */
export function pastHikeYearOptions(now: Date = new Date()): { recent: number[]; earlier: number[] } {
  const current = now.getUTCFullYear();
  const recent: number[] = [];
  const earlier: number[] = [];
  for (let year = current; year >= MIN_PAST_HIKE_YEAR; year--) {
    (current - year < RECENT_PAST_HIKE_YEARS ? recent : earlier).push(year);
  }
  return { recent, earlier };
}

type StatusCompletion = SourceLike & {
  id: string;
  trail_id: string;
  status: CompletionStatus;
  completed_at: string;
  pending_hike_id?: string | null;
};

export type TrailCompletionStatus<T extends StatusCompletion = TrailCompletion> =
  | { kind: 'completed'; completion: T }
  /** `reviewing`: a hike recorded later on the trail waits for review; the trail stays done meanwhile. */
  | { kind: 'past'; completion: T; year: number | null; reviewing: boolean }
  | { kind: 'pending'; completion: T }
  | { kind: 'none' };

function newestFirst<T extends { completed_at: string }>(a: T, b: T): number {
  return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
}

/**
 * What the trail screen says about the user's own completion of a trail. A
 * recorded (or photo) completion wins over a past one, a past one over a hike
 * waiting for review; a rejected completion counts as none.
 */
export function selectTrailCompletionStatus<T extends StatusCompletion>(
  completions: T[] | null | undefined,
  trailId: string,
): TrailCompletionStatus<T> {
  const forTrail = (completions ?? []).filter((c) => c.trail_id === trailId).sort(newestFirst);

  const recorded = forTrail.find((c) => c.status === 'approved' && !isPastHike(c));
  if (recorded) return { kind: 'completed', completion: recorded };

  const past = forTrail.find((c) => c.status === 'approved' && isPastHike(c));
  if (past) return { kind: 'past', completion: past, year: pastHikeYear(past), reviewing: !!past.pending_hike_id };

  const pending = forTrail.find((c) => c.status === 'pending');
  if (pending) return { kind: 'pending', completion: pending };

  return { kind: 'none' };
}

type CachedTrail = NonNullable<TrailCompletion['trails']>;

/**
 * The new past hike as an entry of the cached "my completions" list, so the
 * trail screen and the profile show it before the list is fetched again. The
 * trail details come from the trail screen's cached detail when there is one.
 */
export function pastHikeToCompletion(
  result: PastHikeResponse,
  trail?: CachedTrail | null,
  now: Date = new Date(),
): TrailCompletion {
  return {
    id: result.id,
    user_id: result.user_id,
    trail_id: result.trail_id,
    proof_photo_url: null,
    photo_lat: null,
    photo_lng: null,
    status: result.status ?? 'approved',
    source: result.source ?? 'past',
    elapsed_seconds: null,
    reviewer_note: null,
    completed_at: result.completed_at,
    created_at: now.toISOString(),
    trails: trail
      ? {
          id: trail.id,
          name_en: trail.name_en,
          name_ka: trail.name_ka ?? null,
          difficulty: trail.difficulty,
          region: trail.region,
          cover_image_url: trail.cover_image_url ?? null,
          distance_km: trail.distance_km ?? null,
          elevation_gain_m: trail.elevation_gain_m ?? null,
          estimated_hours: trail.estimated_hours ?? null,
        }
      : undefined,
  };
}

/** Adds an entry to a cached list, or merges it into the entry with the same id. Nothing cached: nothing to do. */
export function upsertCompletion<T extends { id: string }>(list: T[] | undefined, item: T): T[] | undefined {
  if (!list) return list;
  const index = list.findIndex((c) => c.id === item.id);
  if (index === -1) return [item, ...list];
  const next = list.slice();
  next[index] = { ...list[index], ...item };
  return next;
}

/**
 * A recorded hike on a trail marked done by a past hike, which did not verify: the
 * server saved it for review and kept the past mark. It does not count for the
 * leaderboard (yet), and the trail was not "already completed" by a recorded hike.
 */
export function recordKeptPastMark(result: Pick<RecordHikeResponse, 'source'> | null | undefined): boolean {
  return result?.source === 'past';
}

/** The message to show when marking a past hike failed. */
export function pastHikeErrorMessage(error: unknown): string {
  const status = getErrorStatus(error);
  // Server trouble (for example the feature not switched on yet): worth another try
  if (status !== undefined && status >= 500) {
    return 'Could not mark this trail as done right now. Please try again in a little while.';
  }
  const message = getErrorMessage(error, 'Could not mark this trail as done. Please try again.');
  // A server from before past hikes answers with its generic missing-route message
  if (status === 404 && /^Cannot (POST|GET)\b/i.test(message)) {
    return 'Marking past hikes is not available yet. Please try again later.';
  }
  return message;
}
