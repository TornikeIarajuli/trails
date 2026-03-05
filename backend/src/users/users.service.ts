import { TtlCache } from '../common/ttl-cache';
const LEADERBOARD_TTL = 15 * 60 * 1000;

import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
  private cache = new TtlCache();
  constructor(
    private supabaseService: SupabaseService,
    private notificationsService: NotificationsService,
  ) {}

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
    data: { full_name?: string; bio?: string },
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
    const cacheKey = `leaderboard:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('profiles')
      .select('id, username, full_name, avatar_url, total_trails_completed')
      .gt('total_trails_completed', 0)
      .order('total_trails_completed', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const result = data?.map((user, index) => ({
      rank: index + 1,
      ...user,
    }));
    this.cache.set(cacheKey, result, LEADERBOARD_TTL);
    return result;
  }

  async deleteAccount(userId: string) {
    const admin = this.supabaseService.getAdminClient();

    // Helper to extract storage object path from a public URL
    const extractPath = (url: string, bucket: string): string | null => {
      const marker = `/object/public/${bucket}/`;
      const idx = url.indexOf(marker);
      return idx >= 0
        ? decodeURIComponent(url.slice(idx + marker.length))
        : null;
    };

    // 1. Delete hike photos from trail-media bucket
    const { data: hikePhotos } = await admin
      .from('trail_photos')
      .select('url')
      .eq('user_id', userId);
    const hikePaths = (hikePhotos ?? [])
      .map((p) => extractPath(p.url, 'trail-media'))
      .filter(Boolean) as string[];
    if (hikePaths.length) {
      await admin.storage.from('trail-media').remove(hikePaths);
    }

    // 2. Delete proof photos from proof-photos bucket
    const { data: completions } = await admin
      .from('trail_completions')
      .select('proof_photo_url')
      .eq('user_id', userId)
      .not('proof_photo_url', 'is', null);
    const proofPaths = (completions ?? [])
      .map((c) => extractPath(c.proof_photo_url as string, 'proof-photos'))
      .filter(Boolean) as string[];
    if (proofPaths.length) {
      await admin.storage.from('proof-photos').remove(proofPaths);
    }

    // 3. Delete avatar (stored as avatars/{userId}.{ext})
    const { data: avatarFiles } = await admin.storage
      .from('proof-photos')
      .list('avatars', { search: userId });
    const avatarPaths = (avatarFiles ?? []).map((f) => `avatars/${f.name}`);
    if (avatarPaths.length) {
      await admin.storage.from('proof-photos').remove(avatarPaths);
    }

    // 4. Delete auth user — cascades all DB rows via FK ON DELETE CASCADE
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }

  async heartbeat(userId: string) {
    const admin = this.supabaseService.getAdminClient();
    await admin
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', userId);
  }

  async setEmergencyContact(userId: string, contactUserId: string | null) {
    const admin = this.supabaseService.getAdminClient();
    const { error } = await admin
      .from('profiles')
      .update({ emergency_contact_user_id: contactUserId })
      .eq('id', userId);
    if (error) throw error;

    // Notify the contact that they've been chosen
    if (contactUserId) {
      const { data: setter } = await admin
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single();

      if (setter) {
        await this.notificationsService.sendToUser(
          contactUserId,
          'Emergency Contact',
          setter.username +
            ' has set you as their emergency contact. You will be notified if they trigger an SOS.',
          { setterId: userId },
          'emergency_contact',
        );
      }
    }

    return { ok: true };
  }

  async triggerSos(userId: string, lat: number, lng: number) {
    const admin = this.supabaseService.getAdminClient();

    const { data: profile } = await admin
      .from('profiles')
      .select('username, emergency_contact_user_id')
      .eq('id', userId)
      .single();

    if (!profile) throw new NotFoundException('User not found');

    const contactId = profile.emergency_contact_user_id;
    if (contactId) {
      const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
      await this.notificationsService.sendToUser(
        contactId,
        `🆘 SOS from ${profile.username}`,
        `${profile.username} needs help! Location: ${mapsUrl}`,
        { type: 'sos', userId, lat, lng },
        'sos',
      );
    }

    return { sent: !!contactId };
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
      .select(
        'id, username, full_name, avatar_url, bio, total_trails_completed, created_at, last_seen_at',
      )
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
