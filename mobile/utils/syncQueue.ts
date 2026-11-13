import { PendingCompletion } from '../types/completion';

/**
 * Decision logic for uploading hikes that were finished without a connection.
 * Pure on purpose: the hook that drives it only supplies state and performs the I/O.
 */

export type SyncFailureAction = 'drop' | 'retry';

const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 15 * 60_000;

function statusOf(error: unknown): number | undefined {
  const status = (error as { response?: { status?: unknown } } | null | undefined)?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * What to do with a completion whose upload failed.
 *
 * `drop`: the server understood the request and refused it (validation, trail
 * not found) — sending the same data again cannot succeed.
 * `retry`: everything else — no connection, timeout, server error, rate limit,
 * or a session problem (401/403), which is about the user and not the hike.
 */
export function classifySyncFailure(error: unknown): SyncFailureAction {
  const status = statusOf(error);
  if (status === undefined) return 'retry';
  if (status === 401 || status === 403 || status === 408 || status === 429) return 'retry';
  if (status >= 400 && status < 500) return 'drop';
  return 'retry';
}

/** Delay before the next attempt: 15 s, doubling per failed attempt, capped at 15 min. */
export function retryDelayMs(attempts: number): number {
  const exponent = Math.max(0, Math.min(attempts, 20) - 1);
  return Math.min(RETRY_BASE_MS * 2 ** exponent, RETRY_MAX_MS);
}

/**
 * Queue entries the given user may upload, oldest first. An entry without an
 * owner comes from the old single-slot format and goes to whoever is signed in,
 * as it did before.
 */
export function entriesToSync(queue: PendingCompletion[], userId: string | null | undefined): PendingCompletion[] {
  if (!userId) return [];
  return queue.filter((entry) => entry.userId === userId || entry.userId === null);
}

export interface SyncConditions {
  isOnline: boolean;
  isAuthenticated: boolean;
  userId: string | null | undefined;
  queue: PendingCompletion[];
}

export function shouldSync({ isOnline, isAuthenticated, userId, queue }: SyncConditions): boolean {
  return isOnline && isAuthenticated && entriesToSync(queue, userId).length > 0;
}
