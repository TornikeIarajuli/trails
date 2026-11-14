import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { throwIfError } from '../common/supabase-error';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Expo accepts at most 100 messages per request.
const EXPO_BATCH_SIZE = 100;
const EXPO_TIMEOUT_MS = 10_000;
const MAX_DEVICES_PER_USER = 100;

interface ExpoTicket {
  status?: string;
  details?: { error?: string };
}

interface ExpoResponse {
  data?: ExpoTicket[];
  errors?: Array<{ message?: string }>;
}

export interface PushResult {
  /** Devices for which Expo accepted the push (tickets with status "ok"). */
  sent: number;
  skipped?: 'user_preference';
  error?: string;
}

export interface NotificationRow {
  id?: string;
  type?: string | null;
  data?: Record<string, unknown> | null;
  [key: string]: unknown;
}

function idText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The person a notification is about, from its payload (who followed, commented, needs help…). */
export function notificationActorId(row: NotificationRow): string | null {
  const d = row.data ?? {};
  return (
    idText(d.followerId) ??
    idText(d.commenterId) ??
    idText(d.setterId) ??
    idText(d.actorId) ??
    (row.type === 'sos' ? idText(d.userId) : null)
  );
}

function notificationTrailId(row: NotificationRow): string | null {
  return idText((row.data ?? {}).trailId);
}

function notificationBadgeId(row: NotificationRow): string | null {
  const ids = (row.data ?? {}).badgeIds;
  return Array.isArray(ids) ? idText(ids[0]) : null;
}

const unique = (ids: (string | null)[]) => [
  ...new Set(ids.filter((id): id is string => !!id)),
];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private supabaseService: SupabaseService) {}

  async registerToken(userId: string, token: string, platform = 'expo') {
    const admin = this.supabaseService.getAdminClient();

    // A push token identifies one device, and a device belongs to the account that is
    // signed in on it now: take the token away from every other user first. (Migration
    // 049 also makes the token unique, so this has to happen before the upsert.)
    const { error: releaseError } = await admin
      .from('push_tokens')
      .delete()
      .eq('token', token)
      .neq('user_id', userId);

    throwIfError(releaseError);

    const { error } = await admin.from('push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' },
    );

    throwIfError(error);
    return { registered: true };
  }

  async removeToken(userId: string, token: string) {
    const admin = this.supabaseService.getAdminClient();

    const { error } = await admin
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', token);

    throwIfError(error);
    return { removed: true };
  }

  /**
   * Stores a notification for the user and pushes it to their devices.
   * `type` is the notification type; it is always added to the push `data` so the app can
   * route a tapped notification. Never throws: a failed push must not fail the request
   * that triggered it.
   */
  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    type = 'general',
  ): Promise<PushResult> {
    try {
      return await this.deliver(userId, title, body, type, {
        ...(data ?? {}),
        type,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Push notification failed', message);
      return { sent: 0, error: message };
    }
  }

  private async deliver(
    userId: string,
    title: string,
    body: string,
    type: string,
    payload: Record<string, any>,
  ): Promise<PushResult> {
    const admin = this.supabaseService.getAdminClient();

    // Check notification preferences before sending
    const { data: prefs } = await admin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    // If prefs exist, respect them; if no row yet, defaults are all true
    if (prefs && type in prefs && prefs[type] === false) {
      return { sent: 0, skipped: 'user_preference' };
    }

    // Persist to notification history
    const { error: historyError } = await admin.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body,
      data: payload,
    });
    if (historyError) {
      this.logger.warn(
        `Could not store ${type} notification: ${historyError.message}`,
      );
    }

    const { data: tokens, error: tokensError } = await admin
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(MAX_DEVICES_PER_USER);

    if (tokensError) {
      this.logger.warn(`Could not load push tokens: ${tokensError.message}`);
      return { sent: 0, error: 'Could not load push tokens' };
    }
    if (!tokens || tokens.length === 0) return { sent: 0 };

    const messages = tokens.map((t) => ({
      to: t.token as string,
      sound: 'default' as const,
      title,
      body,
      data: payload,
      // Without this Android delivers at normal priority, which Doze mode may hold back.
      ...(type === 'sos' ? { priority: 'high' as const } : {}),
    }));

    let accepted = 0;
    let failure: string | undefined;
    const deadTokens: string[] = [];

    for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
      const batch = messages.slice(i, i + EXPO_BATCH_SIZE);
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(batch),
          signal: AbortSignal.timeout(EXPO_TIMEOUT_MS),
        });

        const result = (await response.json()) as ExpoResponse | null;
        const tickets = Array.isArray(result?.data) ? result.data : [];

        if (tickets.length === 0) {
          failure =
            result?.errors?.[0]?.message ?? 'Expo returned no push tickets';
        }

        tickets.forEach((ticket, index) => {
          if (ticket?.status === 'ok') {
            accepted++;
          } else if (ticket?.details?.error === 'DeviceNotRegistered') {
            // Expo says this device no longer accepts pushes for the app
            deadTokens.push(batch[index].to);
          }
        });
      } catch (err) {
        failure = err instanceof Error ? err.message : String(err);
      }
    }

    if (failure) this.logger.error('Push notification failed', failure);

    if (deadTokens.length > 0) {
      const { error: cleanupError } = await admin
        .from('push_tokens')
        .delete()
        .in('token', deadTokens);
      if (cleanupError) {
        this.logger.warn(
          `Could not remove dead push tokens: ${cleanupError.message}`,
        );
      }
    }

    return {
      sent: accepted,
      ...(failure && accepted === 0 ? { error: failure } : {}),
    };
  }

  async getNotifications(userId: string, page = 1, limit = 20) {
    const admin = this.supabaseService.getAdminClient();
    const offset = (page - 1) * limit;

    const [list, unread] = await Promise.all([
      admin
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      // Unread across all pages, not just the one being returned
      admin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null),
    ]);

    throwIfError(list.error);
    throwIfError(unread.error);

    return {
      data: await this.withContext((list.data ?? []) as NotificationRow[]),
      unreadCount: unread.count ?? 0,
      total: list.count ?? 0,
    };
  }

  /**
   * Adds who and what each notification is about, so the app can show the person's photo and
   * name, the trail's picture or the badge: `actor`, `trail` and `badge` (null when not
   * applicable). A failed lookup only loses the pictures; the list itself still loads.
   */
  private async withContext(rows: NotificationRow[]) {
    if (rows.length === 0) return rows;
    const admin = this.supabaseService.getAdminClient();
    const actorIds = unique(rows.map(notificationActorId));
    const trailIds = unique(rows.map(notificationTrailId));
    const badgeIds = unique(rows.map(notificationBadgeId));
    const none = { data: [] as Record<string, unknown>[], error: null };

    const [actors, trails, badges] = await Promise.all([
      actorIds.length
        ? admin
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', actorIds)
        : none,
      trailIds.length
        ? admin
            .from('trails')
            .select('id, name_en, cover_image_url')
            .in('id', trailIds)
        : none,
      badgeIds.length
        ? admin
            .from('badges')
            .select('id, name_en, icon, category')
            .in('id', badgeIds)
        : none,
    ]);
    for (const [what, result] of [
      ['profiles', actors],
      ['trails', trails],
      ['badges', badges],
    ] as const) {
      if (result.error) {
        this.logger.warn(
          `Notification ${what} lookup failed: ${result.error.message}`,
        );
      }
    }

    const byId = (items: unknown) =>
      new Map(
        ((items as Record<string, unknown>[] | null) ?? []).map((item) => [
          item.id as string,
          item,
        ]),
      );
    const actorMap = byId(actors.data);
    const trailMap = byId(trails.data);
    const badgeMap = byId(badges.data);

    return rows.map((row) => ({
      ...row,
      actor: actorMap.get(notificationActorId(row) ?? '') ?? null,
      trail: trailMap.get(notificationTrailId(row) ?? '') ?? null,
      badge: badgeMap.get(notificationBadgeId(row) ?? '') ?? null,
    }));
  }

  async markRead(userId: string, notificationId: string) {
    const admin = this.supabaseService.getAdminClient();
    const { error } = await admin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId);
    throwIfError(error);
    return { ok: true };
  }

  async markAllRead(userId: string) {
    const admin = this.supabaseService.getAdminClient();
    const { error } = await admin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);
    throwIfError(error);
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
    throwIfError(error);
    return data;
  }
}
