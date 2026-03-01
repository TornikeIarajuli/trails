import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private supabaseService: SupabaseService) {}

  async getComments(activityId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('activity_comments')
      .select('id, activity_id, activity_type, user_id, comment, created_at, profiles:user_id(username, avatar_url)')
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async createComment(userId: string, dto: CreateCommentDto) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('activity_comments')
      .insert({ activity_id: dto.activity_id, activity_type: dto.activity_type, user_id: userId, comment: dto.comment })
      .select('id, activity_id, activity_type, user_id, comment, created_at, profiles:user_id(username, avatar_url)')
      .single();

    if (error) throw error;
    return data;
  }

  async deleteComment(userId: string, commentId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: existing } = await admin
      .from('activity_comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (!existing) throw new NotFoundException('Comment not found');
    if (existing.user_id !== userId) throw new ForbiddenException("Cannot delete another user's comment");

    const { error } = await admin.from('activity_comments').delete().eq('id', commentId);
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
