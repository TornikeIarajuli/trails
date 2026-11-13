import api from './api';
import { getErrorStatus } from '../utils/showError';

export type ReportTargetType =
  | 'photo'
  | 'comment'
  | 'review'
  | 'condition'
  | 'event'
  | 'user'
  | 'completion'
  | 'trail';

/** Problems with a trail itself (target_type 'trail'). */
export type TrailProblemReason = 'wrong_route' | 'path_missing' | 'wrong_info';

export type ReportReason =
  | 'spam'
  | 'offensive'
  | 'harassment'
  | 'dangerous'
  | 'other'
  | TrailProblemReason;

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam', label: 'Spam or advertising' },
  { key: 'offensive', label: 'Offensive or inappropriate' },
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'dangerous', label: 'Dangerous or misleading' },
  { key: 'other', label: 'Something else' },
];

export const TRAIL_PROBLEM_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'wrong_route', label: 'Wrong route' },
  { key: 'path_missing', label: "Path doesn't exist" },
  { key: 'wrong_info', label: 'Wrong info — distance, time, name…' },
  { key: 'dangerous', label: 'Dangerous' },
  { key: 'other', label: 'Other' },
];

export const REPORT_DETAILS_MAX = 500;

/** True when the API has no moderation endpoints yet (a backend older than this app). */
export function isModerationUnavailable(err: unknown): boolean {
  return getErrorStatus(err) === 404;
}

export const moderationService = {
  /** Reporting the same thing twice is a no-op on the server, so this is safe to repeat. */
  async report(data: {
    target_type: ReportTargetType;
    target_id: string;
    reason: ReportReason;
    details?: string;
  }): Promise<{ reported: boolean }> {
    const response = await api.post('/moderation/reports', data);
    return response.data;
  },

  async getBlockedUserIds(): Promise<string[]> {
    try {
      const response = await api.get('/moderation/blocks');
      const ids = response.data?.blocked_user_ids;
      return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
    } catch (err) {
      // No endpoint means nobody can have been blocked
      if (isModerationUnavailable(err)) return [];
      throw err;
    }
  },

  async blockUser(userId: string): Promise<{ blocked: boolean }> {
    const response = await api.post(`/moderation/blocks/${userId}`);
    return response.data;
  },

  async unblockUser(userId: string): Promise<{ blocked: boolean }> {
    const response = await api.delete(`/moderation/blocks/${userId}`);
    return response.data;
  },
};
