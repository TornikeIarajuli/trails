import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { throwIfError } from '../common/supabase-error';
import { ModerationService } from '../moderation/moderation.service';

export interface FeedItem {
  activity_id: string;
  user_id: string;
  [key: string]: unknown;
}

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    private supabaseService: SupabaseService,
    private moderationService: ModerationService,
  ) {}

  async getFeed(userId: string, page = 1, limit = 20) {
    const admin = this.supabaseService.getAdminClient();
    const offset = (page - 1) * limit;

    const [feed, countResult, blocked] = await Promise.all([
      admin.rpc('get_activity_feed', {
        p_user_id: userId,
        p_limit: limit,
        p_offset: offset,
      }),
      admin.rpc('get_activity_feed_count', { p_user_id: userId }),
      this.moderationService.getBlockedUserIds(userId),
    ]);

    throwIfError(feed.error);
    throwIfError(countResult.error);
    const total = Number(countResult.data ?? 0);

    // Hide what users the caller blocked posted (contract C9)
    const blockedIds = new Set(blocked);
    const items = ((feed.data ?? []) as FeedItem[]).filter(
      (item) => !blockedIds.has(item.user_id),
    );

    return {
      data: await this.withEngagement(userId, items),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Adds like_count, comment_count and liked_by_me (contract C5) with one query for the
   * likes and one for the comments of the whole page. If either fails the items are
   * returned without the fields and the app falls back to fetching them per item.
   */
  private async withEngagement(userId: string, items: FeedItem[]) {
    if (items.length === 0) return items;

    const admin = this.supabaseService.getAdminClient();
    const ids = [...new Set(items.map((item) => String(item.activity_id)))];

    const [likes, comments] = await Promise.all([
      admin
        .from('activity_likes')
        .select('activity_id, user_id')
        .in('activity_id', ids),
      admin
        .from('activity_comments')
        .select('activity_id')
        .in('activity_id', ids),
    ]);

    if (likes.error || comments.error) {
      this.logger.warn(
        `Could not load feed likes/comments: ${(likes.error ?? comments.error)?.message}`,
      );
      return items;
    }

    const likeCounts = new Map<string, number>();
    const likedByMe = new Set<string>();
    for (const like of (likes.data ?? []) as Array<{
      activity_id: string;
      user_id: string;
    }>) {
      likeCounts.set(
        like.activity_id,
        (likeCounts.get(like.activity_id) ?? 0) + 1,
      );
      if (like.user_id === userId) likedByMe.add(like.activity_id);
    }

    const commentCounts = new Map<string, number>();
    for (const comment of (comments.data ?? []) as Array<{
      activity_id: string;
    }>) {
      commentCounts.set(
        comment.activity_id,
        (commentCounts.get(comment.activity_id) ?? 0) + 1,
      );
    }

    return items.map((item) => {
      const id = String(item.activity_id);
      return {
        ...item,
        like_count: likeCounts.get(id) ?? 0,
        comment_count: commentCounts.get(id) ?? 0,
        liked_by_me: likedByMe.has(id),
      };
    });
  }
}
