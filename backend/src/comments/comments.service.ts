import {
  Injectable,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { throwIfError } from '../common/supabase-error';

// Where each commentable activity lives and which column names its owner
const ACTIVITY_SOURCES: Record<string, { table: string; ownerColumn: string }> =
  {
    completion: { table: 'trail_completions', ownerColumn: 'user_id' },
    photo: { table: 'trail_photos', ownerColumn: 'user_id' },
    condition: { table: 'trail_conditions', ownerColumn: 'user_id' },
    review: { table: 'trail_reviews', ownerColumn: 'user_id' },
    event: { table: 'events', ownerColumn: 'organizer_id' },
  };

// What the owner calls each kind of activity: "nino liked your hike"
const ACTIVITY_NOUNS: Record<string, string> = {
  completion: 'hike',
  photo: 'photo',
  condition: 'trail report',
  review: 'review',
  event: 'group hike',
};

const activityNoun = (activityType: string) =>
  ACTIVITY_NOUNS[activityType] ?? 'post';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

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

    throwIfError(error);

    // Fire-and-forget: notify the activity owner (skip if commenter is owner)
    this.notifyActivityOwner(
      userId,
      dto.activity_id,
      dto.activity_type,
      data,
    ).catch(() => {});

    return data;
  }

  /** The owner of an activity and the trail it is on; null when it no longer exists. */
  private async findActivity(
    activityId: string,
    activityType: string,
  ): Promise<{ ownerId: string; trailId: string | null } | null> {
    const source = ACTIVITY_SOURCES[activityType];
    if (!source) return null;

    const admin = this.supabaseService.getAdminClient();
    const columns: string = `${source.ownerColumn}, trail_id`;
    const { data } = await admin
      .from(source.table)
      .select(columns)
      .eq('id', activityId)
      .single();
    const activity = data as Record<string, string | null> | null;

    const ownerId = activity?.[source.ownerColumn] ?? null;
    return ownerId ? { ownerId, trailId: activity?.trail_id ?? null } : null;
  }

  private async notifyActivityOwner(
    commenterId: string,
    activityId: string,
    activityType: string,
    comment: Record<string, any> | null,
  ) {
    const activity = await this.findActivity(activityId, activityType);
    if (!activity || activity.ownerId === commenterId) return;

    const username = comment?.profiles?.username ?? 'Someone';
    await this.notificationsService.sendToUser(
      activity.ownerId,
      'New Comment',
      `${username} commented on your ${activityNoun(activityType)}`,
      {
        activityId,
        activityType,
        commenterId,
        ...(activity.trailId ? { trailId: activity.trailId } : {}),
      },
      'new_comment',
    );
  }

  /**
   * Tells the owner that someone liked their activity. Once per person and activity: liking,
   * taking it back and liking again does not notify again.
   */
  private async notifyLike(
    likerId: string,
    activityId: string,
    activityType: string,
  ) {
    const activity = await this.findActivity(activityId, activityType);
    if (!activity || activity.ownerId === likerId) return;

    const admin = this.supabaseService.getAdminClient();
    const [earlier, liker] = await Promise.all([
      admin
        .from('notifications')
        .select('id')
        .eq('user_id', activity.ownerId)
        .eq('type', 'new_like')
        .eq('data->>activityId', activityId)
        .eq('data->>actorId', likerId)
        .limit(1),
      admin.from('profiles').select('username').eq('id', likerId).single(),
    ]);
    if (earlier.error) {
      // Better a rare second notification than none at all
      this.logger.warn(
        `Could not check for an earlier like notification: ${earlier.error.message}`,
      );
    } else if ((earlier.data ?? []).length > 0) {
      return;
    }

    const username =
      (liker.data as { username?: string } | null)?.username ?? 'Someone';
    await this.notificationsService.sendToUser(
      activity.ownerId,
      'New Like',
      `${username} liked your ${activityNoun(activityType)}`,
      {
        activityId,
        activityType,
        actorId: likerId,
        ...(activity.trailId ? { trailId: activity.trailId } : {}),
      },
      'new_like',
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
    throwIfError(error);
    return { message: 'Deleted' };
  }

  // ── Likes ──────────────────────────────────────────────────────────────────

  async getLikes(activityId: string) {
    const admin = this.supabaseService.getAdminClient();
    const { data, error } = await admin
      .from('activity_likes')
      .select('id, user_id, created_at')
      .eq('activity_id', activityId);

    throwIfError(error);
    return data ?? [];
  }

  async toggleLike(userId: string, activityId: string, activityType: string) {
    const admin = this.supabaseService.getAdminClient();
    const { data, error } = await admin.rpc('toggle_activity_like_full', {
      p_activity_id: activityId,
      p_activity_type: activityType,
      p_user_id: userId,
    });

    throwIfError(error);

    // Fire-and-forget: tell the owner about a new like (not when one is taken back)
    if ((data as { liked?: unknown } | null)?.liked === true) {
      this.notifyLike(userId, activityId, activityType).catch((err) =>
        this.logger.warn(
          `Like notification failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }

    return data; // { liked: boolean, count: number }
  }
}
