import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FollowsService {
  constructor(
    private supabaseService: SupabaseService,
    private notificationsService: NotificationsService,
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
      await admin
        .from('user_follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);

      return { following: false };
    }

    const { error } = await admin
      .from('user_follows')
      .insert({ follower_id: followerId, following_id: followingId });

    if (error) throw error;

    // Send push notification to the followed user
    const { data: followerProfile } = await admin
      .from('profiles')
      .select('username')
      .eq('id', followerId)
      .single();

    const username = followerProfile?.username ?? 'Someone';
    this.notificationsService
      .sendToUser(followingId, 'New Follower', `${username} started following you`, {
        type: 'new_follower',
        followerId,
      })
      .catch(() => {}); // fire-and-forget

    return { following: true };
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

    if (error) throw error;

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

    if (error) throw error;

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

    if (e1) throw e1;

    const { count: followingCount, error: e2 } = await admin
      .from('user_follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', userId);

    if (e2) throw e2;

    return {
      followers_count: followersCount ?? 0,
      following_count: followingCount ?? 0,
    };
  }
}
