import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { throwIfError } from '../common/supabase-error';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';

interface PostRow {
  id: string;
  user_id: string;
  body: string;
  photo_urls: string[] | null;
}

/**
 * Free-form posts: text, photos, optionally a trail and a place. They reach the feed through
 * the activity_feed view (064), with likes, comments, saving and reporting like any post.
 */
@Injectable()
export class PostsService {
  constructor(private supabaseService: SupabaseService) {}

  /** Writes a post and returns it shaped like a feed item, ready to show. */
  async create(userId: string, dto: CreatePostDto) {
    const body = dto.body ?? '';
    const photos = dto.photo_urls ?? [];
    if (!body && photos.length === 0) {
      throw new BadRequestException('Write something or add a photo');
    }
    if (dto.trail_id) await this.assertTrailExists(dto.trail_id);

    const admin = this.supabaseService.getAdminClient();
    const { data, error } = await admin
      .from('posts')
      .insert({
        user_id: userId,
        body,
        trail_id: dto.trail_id ?? null,
        place_name: dto.place_name ?? null,
        photo_urls: photos,
      })
      .select('id')
      .single();
    throwIfError(error);

    return this.feedItem((data as { id: string }).id);
  }

  /** Changes your own post; the fields left out stay as they are. */
  async update(userId: string, postId: string, dto: UpdatePostDto) {
    const post = await this.findOwn(userId, postId);
    const body = dto.body !== undefined ? dto.body : post.body;
    const photos =
      dto.photo_urls !== undefined ? dto.photo_urls : (post.photo_urls ?? []);
    if (!body && photos.length === 0) {
      throw new BadRequestException('Write something or add a photo');
    }
    if (dto.trail_id) await this.assertTrailExists(dto.trail_id);

    const changes: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.body !== undefined) changes.body = dto.body;
    if (dto.trail_id !== undefined) changes.trail_id = dto.trail_id;
    if (dto.place_name !== undefined) changes.place_name = dto.place_name;
    if (dto.photo_urls !== undefined) changes.photo_urls = dto.photo_urls;

    const admin = this.supabaseService.getAdminClient();
    const { error } = await admin
      .from('posts')
      .update(changes)
      .eq('id', postId);
    throwIfError(error);

    return this.feedItem(postId);
  }

  /** Deletes your own post, with its likes, comments and saves. */
  async remove(userId: string, postId: string) {
    await this.findOwn(userId, postId);
    const admin = this.supabaseService.getAdminClient();

    const { error } = await admin.from('posts').delete().eq('id', postId);
    throwIfError(error);

    // Likes, comments and saves point at posts by id only: tidy them up (best effort)
    await Promise.all([
      admin.from('activity_likes').delete().eq('activity_id', postId),
      admin.from('activity_comments').delete().eq('activity_id', postId),
      admin.from('saved_posts').delete().eq('activity_id', postId),
    ]);
    return { deleted: true };
  }

  private async findOwn(userId: string, postId: string): Promise<PostRow> {
    const admin = this.supabaseService.getAdminClient();
    const { data, error } = await admin
      .from('posts')
      .select('id, user_id, body, photo_urls')
      .eq('id', postId)
      .maybeSingle();
    throwIfError(error);
    const post = data as PostRow | null;
    if (!post) throw new NotFoundException('Post not found');
    if (post.user_id !== userId) {
      throw new ForbiddenException('You can only change your own posts');
    }
    return post;
  }

  private async assertTrailExists(trailId: string) {
    const admin = this.supabaseService.getAdminClient();
    const { data, error } = await admin
      .from('trails')
      .select('id')
      .eq('id', trailId)
      .maybeSingle();
    throwIfError(error);
    if (!data) throw new NotFoundException('Trail not found');
  }

  /** The post as the feed shows it; likes, comments and saves are counted by the feed. */
  private async feedItem(postId: string) {
    const admin = this.supabaseService.getAdminClient();
    const { data, error } = await admin.rpc('get_activity_item', {
      p_activity_id: postId,
    });
    throwIfError(error);
    const item = ((data ?? []) as Record<string, unknown>[])[0];
    if (!item) throw new NotFoundException('Post not found');
    return item;
  }
}
