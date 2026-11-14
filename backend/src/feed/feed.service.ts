import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { throwIfError } from '../common/supabase-error';
import { ModerationService } from '../moderation/moderation.service';

export interface FeedItem {
  activity_id: string;
  user_id: string;
  [key: string]: unknown;
}

/** The newest comment of a post, shown under it in the feed. */
export interface LatestComment {
  id: string;
  user_id: string;
  username: string;
  comment: string;
}

interface LatestCommentRow {
  activity_id: string;
  comment_id: string;
  user_id: string;
  username: string;
  comment: string;
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
      data: await this.withEngagement(userId, items, blocked),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Discover: everyone's posts, best first (likes, comments, photos and finished hikes lift a
   * post; older ones slowly sink), so the feed is never empty for someone who follows nobody
   * yet. Leaves out the caller's own posts and anyone they blocked or who blocked them. Items
   * have the feed's shape, likes and comments included.
   */
  async getDiscover(userId: string, page = 1, limit = 20) {
    const admin = this.supabaseService.getAdminClient();
    const offset = (page - 1) * limit;

    const [result, blocked] = await Promise.all([
      admin.rpc('get_discover_feed', {
        p_user_id: userId,
        p_limit: limit,
        p_offset: offset,
      }),
      this.moderationService.getBlockedUserIds(userId),
    ]);

    throwIfError(result.error);
    const rows = (result.data ?? []) as Array<
      FeedItem & { total_count?: number | string }
    >;
    // Every row carries the number of posts in all; past the last page there is no row left
    const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : offset;
    const items = rows.map((row) => {
      const item: FeedItem & { total_count?: number | string } = { ...row };
      delete item.total_count;
      return item as FeedItem;
    });

    return {
      data: await this.withEngagement(userId, items, blocked),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * One post, shaped like a feed item, for notification taps: anyone signed in may open it,
   * unless they blocked its author. Not found when it was deleted, or when it is no longer a
   * post of its own (a photo now shown under its hike).
   */
  async getActivity(userId: string, activityId: string) {
    const admin = this.supabaseService.getAdminClient();
    const [result, blocked] = await Promise.all([
      admin.rpc('get_activity_item', { p_activity_id: activityId }),
      this.moderationService.getBlockedUserIds(userId),
    ]);

    throwIfError(result.error);
    const item = ((result.data ?? []) as FeedItem[])[0];
    if (!item || blocked.includes(item.user_id)) {
      throw new NotFoundException('This post is no longer available');
    }

    const [post] = await this.withEngagement(userId, [item], blocked);
    return post;
  }

  /**
   * Adds like_count, comment_count and liked_by_me (contract C5) with one query for the
   * likes and one for the comments of the whole page. If either fails the items are
   * returned without the fields and the app falls back to fetching them per item.
   * Also adds latest_comment, the newest comment by someone the caller has not blocked;
   * when that cannot be loaded the posts simply show no comment preview.
   */
  private async withEngagement(
    userId: string,
    items: FeedItem[],
    hiddenUserIds: string[] = [],
  ) {
    if (items.length === 0) return items;

    const admin = this.supabaseService.getAdminClient();
    const ids = [...new Set(items.map((item) => String(item.activity_id)))];

    const [likes, comments, latest] = await Promise.all([
      admin
        .from('activity_likes')
        .select('activity_id, user_id')
        .in('activity_id', ids),
      admin
        .from('activity_comments')
        .select('activity_id')
        .in('activity_id', ids),
      admin.rpc('get_latest_comments', {
        p_activity_ids: ids,
        p_hidden_user_ids: hiddenUserIds,
      }),
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

    const latestComments = new Map<string, LatestComment>();
    if (latest.error) {
      this.logger.warn(
        `Could not load the latest comments: ${latest.error.message}`,
      );
    } else {
      for (const row of (latest.data ?? []) as LatestCommentRow[]) {
        latestComments.set(String(row.activity_id), {
          id: row.comment_id,
          user_id: row.user_id,
          username: row.username,
          comment: row.comment,
        });
      }
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
        latest_comment: latestComments.get(id) ?? null,
      };
    });
  }
}
