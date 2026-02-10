import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';

@Injectable()
export class NotificationsService {
  constructor(private supabaseService: SupabaseService) {}

  async registerToken(userId: string, token: string, platform = 'expo') {
    const admin = this.supabaseService.getAdminClient();

    const { error } = await admin
      .from('push_tokens')
      .upsert(
        { user_id: userId, token, platform, updated_at: new Date().toISOString() },
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

  async sendToUser(userId: string, title: string, body: string, data?: Record<string, any>) {
    const admin = this.supabaseService.getAdminClient();

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

      const result = await response.json();
      return { sent: messages.length, result };
    } catch (err) {
      console.error('Push notification failed:', err);
      return { sent: 0, error: err.message };
    }
  }
}
