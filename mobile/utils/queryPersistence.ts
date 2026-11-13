import type { Query } from '@tanstack/react-query';

/**
 * Query roots worth keeping on the device between launches: what a hiker needs offline
 * (trails, their own profile, completions, bookmarks, badges, recent condition reports).
 * Everything else (feed, comments, likes, notifications, leaderboards, search…) is cheap to
 * refetch and would only make every save of the cache slower.
 */
const OFFLINE_ROOTS = new Set<string>([
  'trails',
  'trail',
  'regions',
  'profile',
  'completions',
  'bookmarks',
  'badges',
  'conditions',
  'checkpoints',
  'checkpointCompletions',
  'myEmergencyContact',
  'moderation',
]);

export function shouldPersistQuery(query: Pick<Query, 'queryKey' | 'state'>): boolean {
  const root = query.queryKey[0];
  return query.state.status === 'success' && typeof root === 'string' && OFFLINE_ROOTS.has(root);
}
