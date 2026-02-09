import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { randomUUID } from 'crypto';

export type MediaType = 'photo' | 'video';

@Injectable()
export class MediaService {
  constructor(private supabaseService: SupabaseService) {}

  async uploadTrailMedia(
    trailId: string,
    file: Buffer,
    fileName: string,
    mimeType: string,
    type: MediaType,
    caption?: string,
  ) {
    const admin = this.supabaseService.getAdminClient();

    // Verify trail exists
    const { data: trail } = await admin
      .from('trails')
      .select('id')
      .eq('id', trailId)
      .single();

    if (!trail) {
      throw new NotFoundException('Trail not found');
    }

    // Upload to Supabase Storage
    const ext = fileName.split('.').pop();
    const storagePath = `trails/${trailId}/${randomUUID()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from('trail-media')
      .upload(storagePath, file, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new BadRequestException(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = admin.storage.from('trail-media').getPublicUrl(storagePath);

    // Get current max sort_order
    const { data: existing } = await admin
      .from('trail_media')
      .select('sort_order')
      .eq('trail_id', trailId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextOrder = existing?.[0] ? existing[0].sort_order + 1 : 0;

    // Save to database
    const { data: media, error: dbError } = await admin
      .from('trail_media')
      .insert({
        trail_id: trailId,
        type,
        url: publicUrl,
        caption,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return media;
  }

  async uploadProofPhoto(file: Buffer, fileName: string, mimeType: string) {
    const admin = this.supabaseService.getAdminClient();

    const ext = fileName.split('.').pop();
    const storagePath = `proofs/${randomUUID()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from('proof-photos')
      .upload(storagePath, file, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new BadRequestException(`Upload failed: ${uploadError.message}`);
    }

    const {
      data: { publicUrl },
    } = admin.storage.from('proof-photos').getPublicUrl(storagePath);

    return { url: publicUrl };
  }

  async uploadAvatar(userId: string, file: Buffer, fileName: string, mimeType: string) {
    const admin = this.supabaseService.getAdminClient();

    const ext = fileName.split('.').pop();
    const storagePath = `avatars/${userId}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from('proof-photos')
      .upload(storagePath, file, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new BadRequestException(`Upload failed: ${uploadError.message}`);
    }

    const {
      data: { publicUrl },
    } = admin.storage.from('proof-photos').getPublicUrl(storagePath);

    // Update profile avatar_url
    await admin
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    return { url: publicUrl };
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
    const url = new URL(media.url);
    const pathParts = url.pathname.split('/trail-media/');
    if (pathParts[1]) {
      await admin.storage.from('trail-media').remove([pathParts[1]]);
    }

    const { error } = await admin
      .from('trail_media')
      .delete()
      .eq('id', mediaId);

    if (error) throw error;

    return { message: 'Media deleted successfully' };
  }
}
