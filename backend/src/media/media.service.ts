import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { TrailsService } from '../trails/trails.service';
import { randomUUID } from 'crypto';
import { throwIfError } from '../common/supabase-error';
import { SniffedType, sniffMediaType } from './sniff';

export type MediaType = 'photo' | 'video';

type AdminClient = ReturnType<SupabaseService['getAdminClient']>;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private supabaseService: SupabaseService,
    private trailsService: TrailsService,
  ) {}

  /** The file's real type, or 415 when it is not an allowed kind. */
  private detectType(
    file: Buffer,
    allowed: ReadonlyArray<SniffedType['kind']>,
  ): SniffedType {
    if (!file.length) {
      throw new BadRequestException('No file provided');
    }
    const type = sniffMediaType(file);
    if (!type || !allowed.includes(type.kind)) {
      throw new UnsupportedMediaTypeException(
        allowed.includes('video')
          ? 'Only JPEG, PNG, WebP, HEIC/HEIF images and MP4/MOV videos are supported'
          : 'Only JPEG, PNG, WebP and HEIC/HEIF images are supported',
      );
    }
    return type;
  }

  private async store(
    admin: AdminClient,
    bucket: string,
    path: string,
    file: Buffer,
    type: SniffedType,
    upsert = false,
  ): Promise<string> {
    const { error } = await admin.storage
      .from(bucket)
      .upload(path, file, { contentType: type.contentType, upsert });

    if (error) {
      this.logger.error(`Storage upload failed: ${error.message}`);
      throw new BadRequestException('Upload failed');
    }

    return admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  private async assertTrailExists(admin: AdminClient, trailId: string) {
    const { data: trail, error } = await admin
      .from('trails')
      .select('id')
      .eq('id', trailId)
      .maybeSingle();

    throwIfError(error);
    if (!trail) {
      throw new NotFoundException('Trail not found');
    }
  }

  async uploadTrailMedia(
    trailId: string,
    file: Buffer,
    caption?: string | null,
  ) {
    const type = this.detectType(file, ['image', 'video']);
    const admin = this.supabaseService.getAdminClient();

    await this.assertTrailExists(admin, trailId);

    const publicUrl = await this.store(
      admin,
      'trail-media',
      `trails/${trailId}/${randomUUID()}.${type.ext}`,
      file,
      type,
    );

    // Get current max sort_order
    const { data: existing } = await admin
      .from('trail_media')
      .select('sort_order')
      .eq('trail_id', trailId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextOrder = existing?.[0] ? existing[0].sort_order + 1 : 0;

    const { data: media, error: dbError } = await admin
      .from('trail_media')
      .insert({
        trail_id: trailId,
        type: (type.kind === 'video' ? 'video' : 'photo') satisfies MediaType,
        url: publicUrl,
        caption: caption ?? null,
        sort_order: nextOrder,
      })
      .select()
      .single();

    throwIfError(dbError);
    this.trailsService.invalidateCache(trailId);

    return media;
  }

  async uploadProofPhoto(file: Buffer) {
    const type = this.detectType(file, ['image']);
    const admin = this.supabaseService.getAdminClient();

    const url = await this.store(
      admin,
      'proof-photos',
      `proofs/${randomUUID()}.${type.ext}`,
      file,
      type,
    );

    return { url };
  }

  /**
   * Stores the avatar at avatars/<userId>.<ext> and points the profile at it. The URL
   * carries a ?v= version so clients can cache it and still see a new picture at once.
   */
  async uploadAvatar(userId: string, file: Buffer) {
    const type = this.detectType(file, ['image']);
    const admin = this.supabaseService.getAdminClient();

    const fileName = `${userId}.${type.ext}`;
    const publicUrl = await this.store(
      admin,
      'proof-photos',
      `avatars/${fileName}`,
      file,
      type,
      true,
    );
    const url = `${publicUrl}?v=${Date.now()}`;

    const { error } = await admin
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', userId);
    throwIfError(error);

    await this.removeStaleAvatars(admin, userId, fileName);

    return { url };
  }

  /** Earlier avatars saved with another extension; best effort. */
  private async removeStaleAvatars(
    admin: AdminClient,
    userId: string,
    keep: string,
  ) {
    try {
      const bucket = admin.storage.from('proof-photos');
      const { data: files, error } = await bucket.list('avatars', {
        search: userId,
      });
      if (error) throw new Error(error.message);

      const stale = (files ?? [])
        .map((f: { name: string }) => f.name)
        .filter((name) => name.startsWith(`${userId}.`) && name !== keep)
        .map((name) => `avatars/${name}`);

      if (stale.length > 0) {
        const { error: removeError } = await bucket.remove(stale);
        if (removeError) throw new Error(removeError.message);
      }
    } catch (err) {
      this.logger.warn(
        `Could not remove old avatar files: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Uploads a photo taken on a hike and creates its trail_photos row. */
  async uploadHikePhoto(
    userId: string,
    trailId: string,
    file: Buffer,
    caption?: string | null,
  ) {
    const type = this.detectType(file, ['image']);
    const admin = this.supabaseService.getAdminClient();

    await this.assertTrailExists(admin, trailId);

    const publicUrl = await this.store(
      admin,
      'trail-media',
      `hike-photos/${trailId}/${randomUUID()}.${type.ext}`,
      file,
      type,
    );

    const { data: photo, error: dbError } = await admin
      .from('trail_photos')
      .insert({
        trail_id: trailId,
        user_id: userId,
        url: publicUrl,
        caption: caption ?? null,
        taken_at: new Date().toISOString(),
      })
      .select()
      .single();

    throwIfError(dbError);
    this.trailsService.invalidateCache(trailId);

    return photo;
  }

  async deleteMedia(mediaId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: media, error: fetchError } = await admin
      .from('trail_media')
      .select('*')
      .eq('id', mediaId)
      .single();

    if (fetchError || !media) {
      throw new NotFoundException('Media not found');
    }

    // Extract storage path from URL
    try {
      const pathParts = new URL(media.url).pathname.split('/trail-media/');
      if (pathParts[1]) {
        await admin.storage
          .from('trail-media')
          .remove([decodeURIComponent(pathParts[1])]);
      }
    } catch (err) {
      this.logger.warn(
        `Could not remove a media file: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const { error } = await admin
      .from('trail_media')
      .delete()
      .eq('id', mediaId);

    throwIfError(error);
    this.trailsService.invalidateCache(media.trail_id);

    return { message: 'Media deleted successfully' };
  }
}
