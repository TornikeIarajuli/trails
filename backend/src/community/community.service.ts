import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { ReportConditionDto } from './dto/report-condition.dto';
import { UploadPhotoDto } from './dto/upload-photo.dto';

@Injectable()
export class CommunityService {
  constructor(private supabaseService: SupabaseService) {}

  // ---- Trail Conditions ----

  async reportCondition(userId: string, dto: ReportConditionDto) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('trail_conditions')
      .insert({
        trail_id: dto.trail_id,
        user_id: userId,
        condition_type: dto.condition_type,
        severity: dto.severity,
        description: dto.description,
        photo_url: dto.photo_url,
      })
      .select(
        `
        *,
        profiles:user_id (id, username, avatar_url)
      `,
      )
      .single();

    if (error) throw error;
    return data;
  }

  async getTrailConditions(trailId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('trail_conditions')
      .select(
        `
        *,
        profiles:user_id (id, username, avatar_url)
      `,
      )
      .eq('trail_id', trailId)
      .eq('is_active', true)
      .order('reported_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async deactivateCondition(userId: string, conditionId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: condition } = await admin
      .from('trail_conditions')
      .select('id, user_id')
      .eq('id', conditionId)
      .single();

    if (!condition) throw new NotFoundException('Condition not found');
    if (condition.user_id !== userId)
      throw new ForbiddenException('You can only deactivate your own reports');

    const { error } = await admin
      .from('trail_conditions')
      .update({ is_active: false })
      .eq('id', conditionId);

    if (error) throw error;
    return { message: 'Condition report deactivated' };
  }

  // ---- Trail Photos ----

  async uploadPhoto(userId: string, dto: UploadPhotoDto) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('trail_photos')
      .insert({
        trail_id: dto.trail_id,
        user_id: userId,
        url: dto.url,
        caption: dto.caption,
      })
      .select(
        `
        *,
        profiles:user_id (id, username, avatar_url)
      `,
      )
      .single();

    if (error) throw error;
    return data;
  }

  async getTrailPhotos(trailId: string, page = 1, limit = 20) {
    const admin = this.supabaseService.getAdminClient();
    const offset = (page - 1) * limit;

    const { data, error, count } = await admin
      .from('trail_photos')
      .select(
        `
        *,
        profiles:user_id (id, username, avatar_url)
      `,
        { count: 'exact' },
      )
      .eq('trail_id', trailId)
      .order('taken_at', { ascending: false })
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

  async toggleLike(userId: string, photoId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin.rpc('toggle_photo_like', {
      p_photo_id: photoId,
      p_user_id: userId,
    });

    if (error) throw error;
    return data;
  }

  async deletePhoto(userId: string, photoId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: photo } = await admin
      .from('trail_photos')
      .select('id, user_id')
      .eq('id', photoId)
      .single();

    if (!photo) throw new NotFoundException('Photo not found');
    if (photo.user_id !== userId)
      throw new ForbiddenException('You can only delete your own photos');

    const { error } = await admin
      .from('trail_photos')
      .delete()
      .eq('id', photoId);

    if (error) throw error;
    return { message: 'Photo deleted' };
  }
}
