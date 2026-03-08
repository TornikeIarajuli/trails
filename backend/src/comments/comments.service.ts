import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private supabaseService: SupabaseService,
    private notificationsService: NotificationsService,
  ) {}

  async getComments(activityId: string, page = 1, limit = 50) {
    const admin = this.supabaseService.getAdminClient();
    const offset = (page - 1) * limit;

    const { data, error, count } = await admin
      .from('activity_comments')
      .select(
        'id, activity_id, activity_type, user_id, comment, created_at, profiles:user_id(username, avatar_url)',
        { count: 'exact' },
      )
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true })
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

  async createComment(userId: string, dto: CreateCommentDto) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('activity_comments')
      .insert({
        activity_id: dto.activity_id,
        activity_type: dto.activity_type,
        user_id: userId,
        comment: dto.comment,
      })
      .select(
        'id, activity_id, activity_type, user_id, comment, created_at, profiles:user_id(username, avatar_url)',
      )
      .single();

    if (error) throw error;

    // Fire-and-forget: notify the activity owner (skip if commenter is owner)
    this.notifyActivityOwner(userId, dto.activity_id, dto.activity_type, data).catch(() => {});

    return data;
  }

  private async notifyActivityOwner(
    commenterId: string,
    activityId: string,
    activityType: string,
    comment: Record<string, any>,
  ) {
    const admin = this.supabaseService.getAdminClient();

    // Resolve owner of the activity
    let ownerId: string | null = null;
    if (activityType === 'completion') {
      const { data } = await admin
        .from('completions')
        .select('user_id')
        .eq('id', activityId)
        .single();
      ownerId = data?.user_id ?? null;
    } else if (activityType === 'event') {
      const { data } = await admin
        .from('events')
        .select('organizer_id')
        .eq('id', activityId)
        .single();
      ownerId = data?.organizer_id ?? null;
    }

    if (!ownerId || ownerId === commenterId) return;

    const username = (comment.profiles as any)?.username ?? 'Someone';
    await this.notificationsService.sendToUser(
      ownerId,
      'New Comment',
      `${username} commented on your activity`,
      { activityId, activityType, commenterId },
      'new_comment',
    );
  }

  async deleteComment(userId: string, commentId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: existing } = await admin
      .from('activity_comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (!existing) throw new NotFoundException('Comment not found');
    if (existing.user_id !== userId)
      throw new ForbiddenException("Cannot delete another user's comment");

    const { error } = await admin
      .from('activity_comments')
      .delete()
      .eq('id', commentId);
    if (error) throw error;
    return { message: 'Deleted' };
  }

  // ── Likes ──────────────────────────────────────────────────────────────────

  async getLikes(activityId: string) {
    const admin = this.supabaseService.getAdminClient();
    const { data, error } = await admin
      .from('activity_likes')
      .select('id, user_id, created_at')
      .eq('activity_id', activityId);

    if (error) throw error;
    return data ?? [];
  }

  async toggleLike(userId: string, activityId: string, activityType: string) {
    const admin = this.supabaseService.getAdminClient();
    const { data, error } = await admin.rpc('toggle_activity_like_full', {
      p_activity_id: activityId,
      p_activity_type: activityType,
      p_user_id: userId,
    });

    if (error) throw error;
    return data; // { liked: boolean, count: number }
  }
}
