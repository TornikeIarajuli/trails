import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';

@Injectable()
export class UsersService {
  constructor(private supabaseService: SupabaseService) {}

  async getProfile(userId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: profile, error } = await admin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new NotFoundException('User not found');
    }

    // Get completion stats by difficulty
    const { data: completions } = await admin
      .from('trail_completions')
      .select(
        `
        trail_id,
        status,
        trails:trail_id (difficulty)
      `,
      )
      .eq('user_id', userId)
      .eq('status', 'approved');

    const stats = {
      easy: 0,
      medium: 0,
      hard: 0,
      ultra: 0,
      total: completions?.length ?? 0,
    };

    completions?.forEach((c: Record<string, unknown>) => {
      const trail = c.trails as { difficulty: string } | null;
      if (trail?.difficulty && trail.difficulty in stats) {
        stats[trail.difficulty as keyof typeof stats]++;
      }
    });

    return {
      ...profile,
      stats,
    };
  }

  async updateProfile(
    userId: string,
    data: { full_name?: string; bio?: string; avatar_url?: string },
  ) {
    const admin = this.supabaseService.getAdminClient();

    const { data: profile, error } = await admin
      .from('profiles')
      .update(data)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    if (!profile) throw new NotFoundException('User not found');

    return profile;
  }

  async getLeaderboard(limit: number = 20) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('profiles')
      .select('id, username, full_name, avatar_url, total_trails_completed')
      .gt('total_trails_completed', 0)
      .order('total_trails_completed', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data?.map((user, index) => ({
      rank: index + 1,
      ...user,
    }));
  }

  async searchUsers(query: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(20);

    if (error) throw error;
    return data ?? [];
  }

  async getPublicProfile(userId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: profile, error } = await admin
      .from('profiles')
      .select('id, username, full_name, avatar_url, bio, total_trails_completed, created_at')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new NotFoundException('User not found');
    }

    // Get all approved completions with trail info and proof photos
    const { data: completions } = await admin
      .from('trail_completions')
      .select(
        `
        id,
        completed_at,
        proof_photo_url,
        trails:trail_id (id, name_en, difficulty, region, cover_image_url, distance_km, elevation_gain_m)
      `,
      )
      .eq('user_id', userId)
      .eq('status', 'approved')
      .order('completed_at', { ascending: false });

    // Build stats by difficulty
    const stats = {
      easy: 0,
      medium: 0,
      hard: 0,
      ultra: 0,
      total: completions?.length ?? 0,
    };

    completions?.forEach((c: Record<string, unknown>) => {
      const trail = c.trails as { difficulty: string } | null;
      if (trail?.difficulty && trail.difficulty in stats) {
        stats[trail.difficulty as keyof typeof stats]++;
      }
    });

    return {
      ...profile,
      stats,
      completions: completions ?? [],
    };
  }
}
