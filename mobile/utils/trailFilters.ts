import { TrailDifficulty } from '../types/trail';

/** The difficulty choices in the Explore filters, easiest first. */
export const DIFFICULTY_OPTIONS: readonly TrailDifficulty[] = ['easy', 'medium', 'hard', 'ultra'];

export function difficultyLabel(difficulty: TrailDifficulty): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

/**
 * How many of the filter sheet's filters are set, for the badge on the Filters button.
 * Pass `region: null` where the region does not apply (Near Me ignores it).
 */
export function activeFilterCount({
  difficulty,
  region,
}: {
  difficulty: TrailDifficulty | null;
  region: string | null;
}): number {
  return (difficulty ? 1 : 0) + (region ? 1 : 0);
}

/** The label of the button that closes the filter sheet; `count` is null while it is not known. */
export function showResultsLabel(count: number | null): string {
  if (count === null) return 'Show trails';
  if (count === 0) return 'No trails match';
  return `Show ${count} ${count === 1 ? 'trail' : 'trails'}`;
}
