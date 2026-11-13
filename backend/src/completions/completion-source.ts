/** Where a completion comes from (trail_completions.source, migration 054). */
export type CompletionSource = 'hike' | 'photo' | 'past';

export const MISSING_SOURCE_WARNING =
  'trail_completions.source does not exist yet (migration 054); completions are treated as recorded hikes';

/** False for rows read before migration 054 added the column. */
export function hasSource(row: unknown): boolean {
  return (
    typeof row === 'object' &&
    row !== null &&
    Object.prototype.hasOwnProperty.call(row, 'source')
  );
}

/**
 * The row with `source` set. Rows from before migration 054 have none; they can never be
 * past hikes, so they count as recorded hikes.
 */
export function withSource<T extends object>(
  row: T,
): T & { source: CompletionSource } {
  const source = (row as { source?: unknown }).source;
  return {
    ...row,
    source:
      source === 'photo' || source === 'past' || source === 'hike'
        ? source
        : 'hike',
  };
}
