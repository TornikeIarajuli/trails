import api from './api';
import { getErrorStatus } from '../utils/showError';

export type ReportTargetType =
  | 'photo'
  | 'comment'
  | 'review'
  | 'condition'
  | 'event'
  | 'user'
  | 'completion';

export type ReportReason = 'spam' | 'offensive' | 'harassment' | 'dangerous' | 'other';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam', label: 'Spam or advertising' },
  { key: 'offensive', label: 'Offensive or inappropriate' },
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'dangerous', label: 'Dangerous or misleading' },
  { key: 'other', label: 'Something else' },
];

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
