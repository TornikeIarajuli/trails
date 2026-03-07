import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';

@Injectable()
export class NotificationsService {
  constructor(private supabaseService: SupabaseService) {}

  async registerToken(userId: string, token: string, platform = 'expo') {
    const admin = this.supabaseService.getAdminClient();

    // Delete stale tokens (e.g. Expo Go tokens) before registering the new one
    await admin.from('push_tokens').delete().eq('user_id', userId).neq('token', token);

    const { error } = await admin.from('push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' },
    );

    if (error) throw error;
    return { registered: true };
  }

  async removeToken(userId: string, token: string) {
    const admin = this.supabaseService.getAdminClient();

    await admin
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', token);

    return { removed: true };
  }

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    type = 'general',
  ) {
    const admin = this.supabaseService.getAdminClient();

    // Check notification preferences before sending
    const { data: prefs } = await admin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    // If prefs exist, respect them; if no row yet, defaults are all true
    if (prefs) {
      const prefKey = type as keyof typeof prefs;
      if (prefKey in prefs && prefs[prefKey] === false) {
        return { sent: 0, skipped: 'user_preference' };
      }
    }

    // Persist to notification history
    await admin.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body,
      data: data ?? null,
    });

    const { data: tokens } = await admin
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId);

    if (!tokens || tokens.length === 0) return { sent: 0 };

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: 'default' as const,
      title,
      body,
      data: data ?? {},
    }));

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = (await response.json()) as {
        data: Array<{ status: string; details?: { error?: string } }>;
      };

      // Clean up tokens Expo says are no longer registered
      if (Array.isArray(result.data)) {
        const deadTokens = tokens
          .filter(
            (_, i) =>
              result.data[i]?.status === 'error' &&
              result.data[i]?.details?.error === 'DeviceNotRegistered',
          )
          .map((t) => t.token);
        if (deadTokens.length > 0) {
          void admin.from('push_tokens').delete().in('token', deadTokens);
        }
      }

      return { sent: messages.length, result };
    } catch (err) {
      console.error('Push notification failed:', err);
      return { sent: 0, error: err.message };
    }
  }

  async getNotifications(userId: string, page = 1, limit = 20) {
    const admin = this.supabaseService.getAdminClient();
    const offset = (page - 1) * limit;

    const { data, error, count } = await admin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const unreadCount = data?.filter((n) => !n.read_at).length ?? 0;
    return { data: data ?? [], unreadCount, total: count ?? 0 };
  }

  async markRead(userId: string, notificationId: string) {
    const admin = this.supabaseService.getAdminClient();
    const { error } = await admin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId);
    if (error) throw error;
    return { ok: true };
  }

  async markAllRead(userId: string) {
    const admin = this.supabaseService.getAdminClient();
    const { error } = await admin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);
    if (error) throw error;
    return { ok: true };
  }

  async getPreferences(userId: string) {
    const admin = this.supabaseService.getAdminClient();
    const { data } = await admin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Return defaults if no row yet
    return (
      data ?? {
        user_id: userId,
        new_follower: true,
        badge_earned: true,
        completion_approved: true,
        event_invite: true,
        trail_condition: true,
      }
    );
  }

  async updatePreferences(
    userId: string,
    prefs: Partial<{
      new_follower: boolean;
      badge_earned: boolean;
      completion_approved: boolean;
      event_invite: boolean;
      trail_condition: boolean;
    }>,
  ) {
    const admin = this.supabaseService.getAdminClient();
    const { data, error } = await admin
      .from('notification_preferences')
      .upsert({ user_id: userId, ...prefs }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
