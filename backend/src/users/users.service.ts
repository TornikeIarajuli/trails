import { TtlCache } from '../common/ttl-cache';
import { isMissingRelationError, throwIfError } from '../common/supabase-error';
const LEADERBOARD_TTL = 15 * 60 * 1000;

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { TrailsService } from '../trails/trails.service';
import { RegionProgressResponse, regionProgress } from '../trails/region-stats';
import {
  MISSING_SOURCE_WARNING,
  withSource,
} from '../completions/completion-source';

export type SosOutcome = 'ok' | 'no_contact' | 'contact_unreachable';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  // One entry per requested size (1-100)
  private cache = new TtlCache(100);
  constructor(
    private supabaseService: SupabaseService,
    private notificationsService: NotificationsService,
    private trailsService: TrailsService,
  ) {}

  /** Completed vs. published trails per region, e.g. 3/14 in Khevsureti. */
  async getRegionProgress(userId: string): Promise<RegionProgressResponse> {
    const admin = this.supabaseService.getAdminClient();

    const [summaries, completions] = await Promise.all([
      this.trailsService.getRegionSummaries(),
      admin
        .from('trail_completions')
        .select('trail_id')
        .eq('user_id', userId)
        .eq('status', 'approved'),
    ]);

    throwIfError(completions.error);
    return regionProgress(
      summaries,
      (completions.data ?? []).map((c: { trail_id: string }) => c.trail_id),
    );
  }

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
    data: {
      full_name?: string;
      bio?: string;
      contact_info?: string | null;
      instagram_handle?: string | null;
    },
  ) {
    const admin = this.supabaseService.getAdminClient();

    const { data: profile, error } = await admin
      .from('profiles')
      .update(data)
      .eq('id', userId)
      .select()
      .single();

    throwIfError(error);
    if (!profile) throw new NotFoundException('User not found');

    return profile;
  }

  async getLeaderboard(limit: number = 20) {
    const cacheKey = `leaderboard:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const admin = this.supabaseService.getAdminClient();
    // Ranked by trails hiked with the app: self-reported past hikes do not count.
    const query = (column: string) =>
      admin
        .from('profiles')
        .select(`id, username, full_name, avatar_url, ${column}`)
        .gt(column, 0)
        .order(column, { ascending: false })
        .limit(limit);

    let column = 'ranked_trails_completed';
    let { data, error } = await query(column);
    if (isMissingRelationError(error)) {
      // Before migration 054 there is only the total
      this.logger.warn(
        'profiles.ranked_trails_completed does not exist yet (migration 054); ranking by total',
      );
      column = 'total_trails_completed';
      ({ data, error } = await query(column));
    }

    throwIfError(error);

    // total_trails_completed carries the ranked count too, for released app builds
    const result = (
      (data ?? []) as unknown as Array<Record<string, unknown>>
    ).map((user, index) => {
      const { [column]: count, ...rest } = user;
      return {
        rank: index + 1,
        ...rest,
        total_trails_completed: count as number,
        ranked_trails_completed: count as number,
      };
    });
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
    throwIfError(error);
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

    const { data: setter } = await admin
      .from('profiles')
      .select('username, emergency_contact_user_id')
      .eq('id', userId)
      .single();

    if (!setter) throw new NotFoundException('User not found');

    let contactId: string | null = null;
    if (contactUserId) {
      if (contactUserId.toLowerCase() === userId.toLowerCase()) {
        throw new BadRequestException(
          'You cannot be your own emergency contact',
        );
      }

      const { data: contact } = await admin
        .from('profiles')
        .select('id')
        .eq('id', contactUserId)
        .single();

      if (!contact) throw new NotFoundException('User not found');
      contactId = contact.id as string;
    }

    const { error } = await admin
      .from('profiles')
      .update({ emergency_contact_user_id: contactId })
      .eq('id', userId);
    throwIfError(error);

    // Notify the contact that they've been chosen (once, not on every re-save)
    if (contactId && contactId !== setter.emergency_contact_user_id) {
      await this.notificationsService.sendToUser(
        contactId,
        'Emergency Contact',
        setter.username +
          ' has set you as their emergency contact. You will be notified if they trigger an SOS.',
        { setterId: userId },
        'emergency_contact',
      );
    }

    return { ok: true };
  }

  async triggerSos(
    userId: string,
    lat: number,
    lng: number,
  ): Promise<{ sent: boolean; reason: SosOutcome; devices: number }> {
    // The coordinates end up in a link inside the alert, so they must be plain numbers.
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      throw new BadRequestException('Invalid coordinates');
    }

    const admin = this.supabaseService.getAdminClient();

    const { data: profile } = await admin
      .from('profiles')
      .select('username, emergency_contact_user_id')
      .eq('id', userId)
      .single();

    if (!profile) throw new NotFoundException('User not found');

    const contactId: string | null = profile.emergency_contact_user_id;
    if (!contactId) return { sent: false, reason: 'no_contact', devices: 0 };

    const latitude = lat.toFixed(6);
    const longitude = lng.toFixed(6);
    const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;

    const push = await this.notificationsService.sendToUser(
      contactId,
      `🆘 SOS from ${profile.username}`,
      `${profile.username} needs help! Location: ${mapsUrl}`,
      { userId, lat: Number(latitude), lng: Number(longitude) },
      'sos',
    );

    // "Sent" means a push service accepted the alert for at least one of the contact's
    // devices, not merely that a contact is configured.
    const devices = push?.sent ?? 0;
    return devices > 0
      ? { sent: true, reason: 'ok', devices }
      : { sent: false, reason: 'contact_unreachable', devices: 0 };
  }

  async exportUserData(userId: string) {
    const admin = this.supabaseService.getAdminClient();

    // Gather all user data in parallel
    const [
      profileResult,
      completionsResult,
      reviewsResult,
      bookmarksResult,
      photosResult,
      conditionsResult,
      commentsResult,
      likesResult,
      followersResult,
      followingResult,
      badgesResult,
    ] = await Promise.all([
      admin.from('profiles').select('*').eq('id', userId).single(),
      admin
        .from('trail_completions')
        .select('*, trails:trail_id (name_en, difficulty, region)')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false }),
      admin
        .from('trail_reviews')
        .select('*, trails:trail_id (name_en)')
        .eq('user_id', userId),
      admin
        .from('trail_bookmarks')
        .select('*, trails:trail_id (name_en)')
        .eq('user_id', userId),
      admin.from('trail_photos').select('*').eq('user_id', userId),
      admin.from('trail_conditions').select('*').eq('user_id', userId),
      admin.from('activity_comments').select('*').eq('user_id', userId),
      admin.from('activity_likes').select('*').eq('user_id', userId),
      admin
        .from('user_follows')
        .select(
          'following_id, profiles!user_follows_following_id_fkey (username)',
        )
        .eq('follower_id', userId),
      admin
        .from('user_follows')
        .select(
          'follower_id, profiles!user_follows_follower_id_fkey (username)',
        )
        .eq('following_id', userId),
      admin
        .from('user_badges')
        .select('*, badges:badge_id (name_en, description_en)')
        .eq('user_id', userId),
    ]);

    return {
      exported_at: new Date().toISOString(),
      profile: profileResult.data,
      completions: completionsResult.data ?? [],
      reviews: reviewsResult.data ?? [],
      bookmarks: bookmarksResult.data ?? [],
      photos: photosResult.data ?? [],
      conditions: conditionsResult.data ?? [],
      comments: commentsResult.data ?? [],
      likes: likesResult.data ?? [],
      following: followersResult.data ?? [],
      followers: followingResult.data ?? [],
      badges: badgesResult.data ?? [],
    };
  }

  /**
   * Hikers to follow, for Discover: people followed by those the caller follows first (with
   * one of them as followed_by), then the most active hikers. Never someone the caller
   * already follows, or has a block with either way.
   */
  async getSuggestedHikers(userId: string, limit = 10) {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .rpc('get_suggested_hikers', {
        p_user_id: userId,
        p_limit: Math.min(Math.max(limit, 1), 20),
      });
    throwIfError(error);
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      mutual_count: Number(row.mutual_count ?? 0),
    }));
  }

  async searchUsers(query: string) {
    const admin = this.supabaseService.getAdminClient();

    // Sanitize: strip PostgREST filter syntax characters to prevent filter injection
    // ("*" is PostgREST's alias for the "%" wildcard)
    const sanitized = query.replace(/[,.()"'\\*]/g, '').trim();

    // One character matches nearly every profile, which would let anyone page through
    // the whole user list.
    if (sanitized.length < 2) return [];

    // "%" and "_" are LIKE wildcards: match them literally
    const pattern = `%${sanitized.replace(/[%_]/g, '\\$&')}%`;

    const { data, error } = await admin
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .or(`username.ilike.${pattern},full_name.ilike.${pattern}`)
      .limit(20);

    throwIfError(error);
    return data ?? [];
  }

  async getPublicProfile(userId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: profile, error } = await admin
      .from('profiles')
      .select(
        'id, username, full_name, avatar_url, bio, instagram_handle, total_trails_completed, created_at, last_seen_at',
      )
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new NotFoundException('User not found');
    }

    // Get all approved completions with trail info and proof photos
    const completionsQuery = (withSourceColumn: boolean) =>
      admin
        .from('trail_completions')
        .select(
          `
        id,
        completed_at,
        proof_photo_url,${withSourceColumn ? '\n        source,' : ''}
        trails:trail_id (id, name_en, difficulty, region, cover_image_url, distance_km, elevation_gain_m)
      `,
        )
        .eq('user_id', userId)
        .eq('status', 'approved')
        .order('completed_at', { ascending: false });

    let { data: rows, error: completionsError } = await completionsQuery(true);
    if (isMissingRelationError(completionsError)) {
      this.logger.warn(MISSING_SOURCE_WARNING);
      ({ data: rows, error: completionsError } = await completionsQuery(false));
    }
    if (completionsError) {
      this.logger.warn(
        `Could not load public completions: ${completionsError.message}`,
      );
    }
    const completions = rows
      ? (rows as unknown as Array<Record<string, unknown>>).map((c) =>
          withSource(c),
        )
      : null;

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
