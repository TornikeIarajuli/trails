import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';

@Injectable()
export class BookmarksService {
  constructor(private supabaseService: SupabaseService) {}

  async toggle(userId: string, trailId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: existing } = await admin
      .from('trail_bookmarks')
      .select('id')
      .eq('user_id', userId)
      .eq('trail_id', trailId)
      .single();

    if (existing) {
      await admin
        .from('trail_bookmarks')
        .delete()
        .eq('user_id', userId)
        .eq('trail_id', trailId);

      return { bookmarked: false };
    }

    const { error } = await admin
      .from('trail_bookmarks')
      .insert({ user_id: userId, trail_id: trailId });

    if (error) throw error;
    return { bookmarked: true };
  }

  async getMyBookmarks(userId: string, page = 1, limit = 20) {
    const admin = this.supabaseService.getAdminClient();
    const offset = (page - 1) * limit;

    const { data, error, count } = await admin
      .from('trail_bookmarks')
      .select(
        `
        id,
        created_at,
        trails:trail_id (id, name_en, name_ka, difficulty, region, distance_km, elevation_gain_m, estimated_hours, cover_image_url)
      `,
        { count: 'exact' },
      )
      .eq('user_id', userId)
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

  async isBookmarked(userId: string, trailId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data } = await admin
      .from('trail_bookmarks')
      .select('id')
      .eq('user_id', userId)
      .eq('trail_id', trailId)
      .single();

    return { bookmarked: !!data };
  }
}
