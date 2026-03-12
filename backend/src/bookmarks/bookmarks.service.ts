import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { throwIfError } from '../common/supabase-error';

export type BookmarkCategory = 'saved' | 'want_to_hike' | 'in_progress' | 'favorites';

@Injectable()
export class BookmarksService {
  constructor(private supabaseService: SupabaseService) {}

  async toggle(userId: string, trailId: string, category?: BookmarkCategory) {
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
      .insert({
        user_id: userId,
        trail_id: trailId,
        category: category ?? 'saved',
      });

    throwIfError(error);
    return { bookmarked: true };
  }

  async updateBookmark(
    userId: string,
    trailId: string,
    data: { category?: BookmarkCategory; note?: string | null },
  ) {
    const admin = this.supabaseService.getAdminClient();

    const updateData: Record<string, unknown> = {};
    if (data.category !== undefined) updateData.category = data.category;
    if (data.note !== undefined) updateData.note = data.note;

    if (Object.keys(updateData).length === 0) return { updated: false };

    const { error } = await admin
      .from('trail_bookmarks')
      .update(updateData)
      .eq('user_id', userId)
      .eq('trail_id', trailId);

    throwIfError(error);
    return { updated: true };
  }

  async getMyBookmarks(userId: string, page = 1, limit = 20, category?: string) {
    const admin = this.supabaseService.getAdminClient();
    const offset = (page - 1) * limit;

    let query = admin
      .from('trail_bookmarks')
      .select(
        `
        id,
        created_at,
        category,
        note,
        trails:trail_id (id, name_en, name_ka, difficulty, region, distance_km, elevation_gain_m, estimated_hours, cover_image_url)
      `,
        { count: 'exact' },
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error, count } = await query;

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

  async isBookmarked(userId: string, trailId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data } = await admin
      .from('trail_bookmarks')
      .select('id, category, note')
      .eq('user_id', userId)
      .eq('trail_id', trailId)
      .single();

    return { bookmarked: !!data, category: data?.category ?? null, note: data?.note ?? null };
  }
}
