import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { ModerationService } from '../moderation/moderation.service';
import { throwIfError } from '../common/supabase-error';

// Unfollowing and following again must not push "new follower" every time.
const FOLLOW_NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class FollowsService {
  constructor(
    private supabaseService: SupabaseService,
    private notificationsService: NotificationsService,
    private moderationService: ModerationService,
  ) {}

  async toggle(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const admin = this.supabaseService.getAdminClient();

    const { data: existing } = await admin
      .from('user_follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .single();

    if (existing) {
      const { error: deleteError } = await admin
        .from('user_follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);

      throwIfError(deleteError);
      return { following: false };
    }

    if (
      await this.moderationService.isBlockedEitherWay(followerId, followingId)
    ) {
      throw new ForbiddenException('You cannot follow this user');
    }

    const { error } = await admin
      .from('user_follows')
      .insert({ follower_id: followerId, following_id: followingId });

    throwIfError(error);

    this.notifyNewFollower(followerId, followingId).catch(() => {});

    return { following: true };
  }

  private async notifyNewFollower(followerId: string, followingId: string) {
    const admin = this.supabaseService.getAdminClient();

    const since = new Date(
      Date.now() - FOLLOW_NOTIFICATION_WINDOW_MS,
    ).toISOString();
    const { data: recent, error: recentError } = await admin
      .from('notifications')
      .select('id')
      .eq('user_id', followingId)
      .eq('type', 'new_follower')
      .eq('data->>followerId', followerId)
      .gte('created_at', since)
      .limit(1);

    if (!recentError && (recent ?? []).length > 0) return;

    const { data: followerProfile } = await admin
      .from('profiles')
      .select('username')
      .eq('id', followerId)
      .single();

    const username = followerProfile?.username ?? 'Someone';
    await this.notificationsService.sendToUser(
      followingId,
      'New Follower',
      `${username} started following you`,
      { followerId },
      'new_follower',
    );
  }

  async isFollowing(followerId: string, followingId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data } = await admin
      .from('user_follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .single();

    return { following: !!data };
  }

  async getFollowers(userId: string, page = 1, limit = 20) {
    const admin = this.supabaseService.getAdminClient();
    const offset = (page - 1) * limit;

    const { data, error, count } = await admin
      .from('user_follows')
      .select(
        `
        id,
        created_at,
        profiles:follower_id (id, username, full_name, avatar_url)
      `,
        { count: 'exact' },
      )
      .eq('following_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    throwIfError(error);

    return {
      data: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    };
  }

  async getFollowing(userId: string, page = 1, limit = 20) {
    const admin = this.supabaseService.getAdminClient();
    const offset = (page - 1) * limit;

    const { data, error, count } = await admin
      .from('user_follows')
      .select(
        `
        id,
        created_at,
        profiles:following_id (id, username, full_name, avatar_url)
      `,
        { count: 'exact' },
      )
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    throwIfError(error);

    return {
      data: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    };
  }

  async getCounts(userId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { count: followersCount, error: e1 } = await admin
      .from('user_follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', userId);

    throwIfError(e1);

    const { count: followingCount, error: e2 } = await admin
      .from('user_follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', userId);

    throwIfError(e2);

    return {
      followers_count: followersCount ?? 0,
      following_count: followingCount ?? 0,
    };
  }
}
