import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';

@Injectable()
export class FeedService {
  constructor(private supabaseService: SupabaseService) {}

  async getFeed(userId: string, page = 1, limit = 20) {
    const admin = this.supabaseService.getAdminClient();
    const offset = (page - 1) * limit;

    const { data, error } = await admin.rpc('get_activity_feed', {
      p_user_id: userId,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) throw error;

    const { data: countData, error: countError } = await admin.rpc(
      'get_activity_feed_count',
      { p_user_id: userId },
    );

    if (countError) throw countError;
    const total = countData ?? 0;

    return {
      data: data ?? [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
