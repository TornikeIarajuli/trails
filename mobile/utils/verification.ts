import { CompletionStatus, VerificationReason } from '../types/completion';

/** Plain-language outcome of a recorded hike, for the completion screen. */
export interface CompletionOutcome {
  state: 'verified' | 'unverified' | 'rejected';
  title: string;
  /** Why it was not verified and what that means; null when verified. */
  detail: string | null;
}

const REASONS: VerificationReason[] = ['ok', 'no_track', 'low_coverage', 'too_fast', 'no_route'];

const NOT_COUNTED =
  'It does not count toward your badges or the leaderboard unless an admin approves it.';

function asReason(value: unknown): VerificationReason | null {
  return REASONS.includes(value as VerificationReason) ? (value as VerificationReason) : null;
}

/**
 * The server stores why a hike was not verified as `auto: <reason> (<coverage>%)`
 * in the completion's reviewer note.
 */
export function parseAutoReviewNote(
  note: string | null | undefined,
): { reason: VerificationReason; coveragePercent: number | null } | null {
  const match = /^auto:\s*([a-z_]+)(?:\s*\(\s*(\d+(?:\.\d+)?)\s*%\s*\))?/i.exec(note ?? '');
  if (!match) return null;
  const reason = asReason(match[1].toLowerCase());
  if (!reason) return null;
  return { reason, coveragePercent: match[2] !== undefined ? Number(match[2]) : null };
}

export function describeReason(
  reason: VerificationReason | null,
  coveragePercent?: number | null,
  requiredPercent?: number | null,
): string {
  switch (reason) {
    case 'no_track':
      return 'No GPS track was received for this hike.';
    case 'low_coverage': {
      const covered =
        typeof coveragePercent === 'number' && Number.isFinite(coveragePercent)
          ? ` (${Math.round(coveragePercent)}%${
              typeof requiredPercent === 'number' && Number.isFinite(requiredPercent)
                ? `, ${Math.round(requiredPercent)}% is needed`
                : ''
            })`
          : '';
      return `The recorded GPS track covers too little of the trail${covered}.`;
    }
    case 'too_fast':
      return 'The trail was covered faster than is possible on foot.';
    case 'no_route':
      return 'This trail has no mapped route yet, so the hike could not be checked automatically.';
    default:
      return 'This hike has not been verified yet.';
  }
}

interface OutcomeInput {
  /** Status of the completion as last loaded from the server, when available. */
  status?: CompletionStatus | null;
  reviewerNote?: string | null;
  /** Result reported by the server when the hike was recorded just now. */
  recorded?: {
    verified?: boolean | null;
    reason?: string | null;
    coverage?: number | null;
    requiredCoverage?: number | null;
  } | null;
}

export function describeCompletionOutcome({ status, reviewerNote, recorded }: OutcomeInput): CompletionOutcome {
  if (status === 'rejected') {
    const note = reviewerNote && !parseAutoReviewNote(reviewerNote) ? reviewerNote : null;
    return {
      state: 'rejected',
      title: 'Not approved',
      detail: note ?? 'An admin reviewed this hike and did not approve it.',
    };
  }

  // The stored status wins: an admin may have approved the hike since it was recorded
  const verified = status ? status === 'approved' : recorded?.verified !== false;
  if (verified) return { state: 'verified', title: 'Verified', detail: null };

  const fromNote = parseAutoReviewNote(reviewerNote);
  const reason = asReason(recorded?.reason) ?? fromNote?.reason ?? null;
  const coveragePercent =
    typeof recorded?.coverage === 'number' ? recorded.coverage * 100 : fromNote?.coveragePercent ?? null;
  const requiredPercent =
    typeof recorded?.requiredCoverage === 'number' ? recorded.requiredCoverage * 100 : null;

  return {
    state: 'unverified',
    title: 'Recorded, not verified',
    detail: `${describeReason(reason === 'ok' ? null : reason, coveragePercent, requiredPercent)} ${NOT_COUNTED}`,
  };
}
