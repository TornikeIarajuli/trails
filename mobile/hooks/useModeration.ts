import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  moderationService,
  isModerationUnavailable,
  ReportReason,
  ReportTargetType,
} from '../services/moderation';
import { useAuthStore } from '../store/authStore';
import { queryKeys } from '../utils/queryKeys';
import { getErrorMessage } from '../utils/showError';

const NO_IDS: string[] = [];

export function moderationErrorMessage(err: unknown): string {
  return isModerationUnavailable(err)
    ? 'This is not available right now. Please try again later.'
    : getErrorMessage(err);
}

/** Ids of the users the signed-in user has blocked (empty when signed out or unsupported). */
export function useBlockedUserIds(): Set<string> {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data } = useQuery({
    queryKey: queryKeys.moderation.blocks(),
    queryFn: () => moderationService.getBlockedUserIds(),
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000,
  });

  return useMemo(() => new Set(isAuthenticated ? data ?? NO_IDS : NO_IDS), [data, isAuthenticated]);
}

/**
 * Removes content written by blocked users. `authorId` must be a pure selector —
 * it is intentionally not a dependency, so an inline arrow function is fine.
 */
export function useWithoutBlocked<T>(
  items: T[] | undefined,
  authorId: (item: T) => string | null | undefined,
): T[] {
  const blocked = useBlockedUserIds();

  return useMemo(() => {
    const list = items ?? [];
    if (blocked.size === 0) return list;
    return list.filter((item) => {
      const id = authorId(item);
      return !id || !blocked.has(id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, blocked]);
}

export function useBlockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => moderationService.blockUser(userId),
    onSuccess: (_data, userId) => {
      queryClient.setQueryData<string[]>(queryKeys.moderation.blocks(), (prev) =>
        prev?.includes(userId) ? prev : [...(prev ?? NO_IDS), userId],
      );
      // The server also removes follows in both directions and drops their feed items
      queryClient.invalidateQueries({ queryKey: queryKeys.follows.root() });
      queryClient.invalidateQueries({ queryKey: queryKeys.follows.publicProfile(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed() });
    },
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => moderationService.unblockUser(userId),
    onSuccess: (_data, userId) => {
      queryClient.setQueryData<string[]>(queryKeys.moderation.blocks(), (prev) =>
        (prev ?? NO_IDS).filter((id) => id !== userId),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.feed() });
    },
  });
}

export function useReportContent() {
  return useMutation({
    mutationFn: (data: {
      target_type: ReportTargetType;
      target_id: string;
      reason: ReportReason;
      details?: string;
    }) => moderationService.report(data),
  });
}
