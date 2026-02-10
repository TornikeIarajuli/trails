import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';

@Injectable()
export class BadgesService {
  constructor(private supabaseService: SupabaseService) {}

  async getAllBadges() {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('badges')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data;
  }

  async getUserBadges(userId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('user_badges')
      .select(
        `
        id,
        earned_at,
        badges:badge_id (*)
      `,
      )
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getProgress(userId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin.rpc('get_badge_progress', {
      p_user_id: userId,
    });

    if (error) throw error;
    return data;
  }

  async checkAndAward(userId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin.rpc('check_and_award_badges', {
      p_user_id: userId,
    });

    if (error) throw error;

    // If new badges were awarded, fetch their details
    if (data && data.length > 0) {
      const { data: newBadges } = await admin
        .from('badges')
        .select('*')
        .in('id', data);

      return { new_badges: newBadges ?? [], count: data.length };
    }

    return { new_badges: [], count: 0 };
  }
}
