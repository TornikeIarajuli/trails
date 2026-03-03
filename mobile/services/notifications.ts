import api from './api';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  new_follower: boolean;
  badge_earned: boolean;
  completion_approved: boolean;
  event_invite: boolean;
  trail_condition: boolean;
}

export const notificationsService = {
  async registerToken(token: string, platform = 'expo'): Promise<{ registered: boolean }> {
    const response = await api.post('/notifications/register-token', { token, platform });
    return response.data;
  },

  async removeToken(token: string): Promise<{ removed: boolean }> {
    const response = await api.delete('/notifications/remove-token', {
      data: { token },
    });
    return response.data;
  },

  async getNotifications(page = 1): Promise<{ data: AppNotification[]; unreadCount: number; total: number }> {
    const response = await api.get(`/notifications?page=${page}`);
    return response.data;
  },

  async markRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  },

  async getPreferences(): Promise<NotificationPreferences> {
    const response = await api.get('/notifications/preferences');
    return response.data;
  },

  async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const response = await api.patch('/notifications/preferences', prefs);
    return response.data;
  },
};
