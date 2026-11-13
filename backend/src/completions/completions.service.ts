import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { SubmitCompletionDto } from './dto/submit-completion.dto';
import { RecordHikeDto } from './dto/record-hike.dto';
import { isMissingRelationError, throwIfError } from '../common/supabase-error';
import { envNumber } from '../common/env';
import {
  HikeThresholds,
  HikeVerificationResult,
  parseRouteCoordinates,
  trackDurationSeconds,
  verifyHike,
} from './hike-verification';

type AdminClient = ReturnType<SupabaseService['getAdminClient']>;
type CompletionRow = Record<string, any>;

const MAX_FUTURE_MS = 5 * 60 * 1000;
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;
const PUBLIC_COMPLETIONS_LIMIT = 100;

export function hikeThresholds(): HikeThresholds {
  return {
    toleranceM: envNumber('HIKE_TOLERANCE_M', 120, { min: 10, max: 5000 }),
    minCoverage: envNumber('HIKE_MIN_COVERAGE', 0.6, { min: 0, max: 1 }),
    maxSpeedKmh: envNumber('HIKE_MAX_SPEED_KMH', 15, { min: 1, max: 1000 }),
  };
}

/**
 * When a completion happened: now, or a client-supplied time (offline sync) that is at
 * most 5 minutes in the future and at most 60 days in the past.
 */
export function resolveCompletedAt(
  value: string | undefined,
  now = Date.now(),
): string {
  if (!value) return new Date(now).toISOString();

  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    throw new BadRequestException('completed_at is not a valid date');
  }
  if (time > now + MAX_FUTURE_MS) {
    throw new BadRequestException('completed_at is in the future');
  }
  if (time < now - MAX_AGE_MS) {
    throw new BadRequestException('completed_at is more than 60 days ago');
  }
  return new Date(time).toISOString();
}

/** EWKT for hikes.track, or null when fewer than 2 valid points remain. */
export function trackToEwkt(
  track: ReadonlyArray<readonly number[]> | null | undefined,
): string | null {
  const points: string[] = [];
  for (const [lat, lng] of track ?? []) {
    if (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    ) {
      points.push(`${lng.toFixed(7)} ${lat.toFixed(7)}`);
    }
  }
  return points.length < 2 ? null : `SRID=4326;LINESTRING(${points.join(',')})`;
}

const autoNote = (verification: HikeVerificationResult): string =>
  `auto: ${verification.reason} (${Math.round(verification.coverage * 100)}%)`;

export type RecordedHike = CompletionRow & {
  verified: boolean;
  verification: {
    coverage: number;
    required_coverage: number;
    reason: HikeVerificationResult['reason'];
  };
  new_badge_ids: string[];
  already_existed: boolean;
};

interface CompletionOutcome {
  row: CompletionRow;
  /** The completion became approved during this request. */
  approvedNow: boolean;
  /** An approved completion existed before this request; nothing was changed. */
  alreadyApproved: boolean;
}

@Injectable()
export class CompletionsService {
  private readonly logger = new Logger(CompletionsService.name);
  // Max distance in meters between proof photo GPS and trail endpoint
  private readonly GPS_PROXIMITY_THRESHOLD_M = 500;
  private missingHikesTableLogged = false;

  constructor(
    private supabaseService: SupabaseService,
    private notificationsService: NotificationsService,
  ) {}

  async submit(userId: string, dto: SubmitCompletionDto) {
    const completedAt = resolveCompletedAt(dto.completed_at);
    const admin = this.supabaseService.getAdminClient();

    // Check if already completed
    const { data: existing, error: existingError } = await admin
      .from('trail_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('trail_id', dto.trail_id)
      .maybeSingle();

    throwIfError(existingError);
    if (existing) {
      throw new ConflictException(
        'You have already submitted a completion for this trail',
      );
    }

    // Get trail endpoint for GPS validation
    const { data: trail, error: trailError } = await admin
      .from('trails')
      .select('id, end_point, name_en')
      .eq('id', dto.trail_id)
      .maybeSingle();

    throwIfError(trailError);
    if (!trail) {
      throw new NotFoundException('Trail not found');
    }

    // Validate GPS proximity to trail endpoint
    let status: 'pending' | 'approved' = 'pending';

    if (trail.end_point) {
      const distance = await this.calculateDistanceToEndpoint(
        admin,
        dto.trail_id,
        dto.photo_lat,
        dto.photo_lng,
      );

      if (distance !== null && distance <= this.GPS_PROXIMITY_THRESHOLD_M) {
        status = 'approved'; // Auto-approve if within proximity
      }
    }

    const { data, error } = await admin
      .from('trail_completions')
      .insert({
        user_id: userId,
        trail_id: dto.trail_id,
        proof_photo_url: dto.proof_photo_url,
        photo_lat: dto.photo_lat,
        photo_lng: dto.photo_lng,
        status,
        completed_at: completedAt,
      })
      .select()
      .single();

    if (error?.code === '23505') {
      throw new ConflictException(
        'You have already submitted a completion for this trail',
      );
    }
    throwIfError(error);

    const newBadgeIds =
      status === 'approved' ? await this.onCompletionApproved(userId) : [];

    return {
      ...data,
      auto_approved: status === 'approved',
      new_badge_ids: newBadgeIds,
      message:
        status === 'approved'
          ? 'GPS verified! Trail completion approved automatically.'
          : 'Proof submitted. Pending manual review (GPS too far from endpoint).',
    };
  }

  private async calculateDistanceToEndpoint(
    admin: AdminClient,
    trailId: string,
    lat: number,
    lng: number,
  ): Promise<number | null> {
    const { data, error } = await admin.rpc('distance_to_trail_endpoint', {
      p_trail_id: trailId,
      p_lat: lat,
      p_lng: lng,
    });

    if (error) {
      this.logger.error('GPS distance calculation failed', error?.message);
      return null;
    }

    return typeof data === 'number' ? data : null;
  }

  /**
   * Records a hike the app tracked (contract C1). The track is checked against the
   * trail's route: a verified hike is approved at once, anything else waits for review.
   * Every attempt is also stored in `hikes`.
   */
  async recordHike(userId: string, dto: RecordHikeDto): Promise<RecordedHike> {
    const completedAt = resolveCompletedAt(dto.completed_at);
    let startedAt: string | null = null;
    if (dto.started_at) {
      const started = Date.parse(dto.started_at);
      if (started > Date.parse(completedAt)) {
        throw new BadRequestException('started_at is after completed_at');
      }
      startedAt = new Date(started).toISOString();
    }

    const admin = this.supabaseService.getAdminClient();

    const { data: trail, error: trailError } = await admin
      .from('trails')
      .select('id, distance_km, route')
      .eq('id', dto.trail_id)
      .maybeSingle();

    throwIfError(trailError);
    if (!trail) {
      throw new NotFoundException('Trail not found');
    }

    const track = dto.track ?? [];
    const reportedElapsed =
      typeof dto.elapsed_seconds === 'number'
        ? Math.round(dto.elapsed_seconds)
        : null;
    const thresholds = hikeThresholds();
    const verification = verifyHike({
      route: await this.loadRoute(admin, trail),
      trailDistanceKm:
        trail.distance_km === null || trail.distance_km === undefined
          ? null
          : Number(trail.distance_km),
      track,
      elapsedSeconds: reportedElapsed,
      thresholds,
    });

    const trackDuration = trackDurationSeconds(track);
    const elapsedSeconds =
      reportedElapsed !== null && reportedElapsed > 0
        ? reportedElapsed
        : trackDuration !== null && track.length >= 2
          ? Math.round(trackDuration)
          : reportedElapsed;

    const { data: existing, error: existingError } = await admin
      .from('trail_completions')
      .select('*')
      .eq('user_id', userId)
      .eq('trail_id', dto.trail_id)
      .maybeSingle();

    throwIfError(existingError);

    const outcome = existing
      ? await this.applyToExisting(
          admin,
          existing,
          verification,
          completedAt,
          elapsedSeconds,
        )
      : await this.createFromHike(
          admin,
          userId,
          dto.trail_id,
          verification,
          completedAt,
          elapsedSeconds,
        );

    const newBadgeIds = outcome.approvedNow
      ? await this.onCompletionApproved(userId)
      : [];

    await this.storeHike(admin, {
      user_id: userId,
      trail_id: dto.trail_id,
      completion_id: outcome.row.id ?? null,
      started_at: startedAt,
      completed_at: completedAt,
      elapsed_seconds: elapsedSeconds,
      distance_m:
        typeof dto.distance_m === 'number' ? Math.round(dto.distance_m) : null,
      track: trackToEwkt(track),
      coverage:
        verification.reason === 'no_track' || verification.reason === 'no_route'
          ? null
          : verification.coverage,
      verified: verification.verified,
      reason: verification.reason,
    });

    return {
      ...outcome.row,
      verified: outcome.row.status === 'approved',
      verification: {
        coverage: verification.coverage,
        required_coverage: thresholds.minCoverage,
        reason: verification.reason,
      },
      new_badge_ids: newBadgeIds,
      already_existed: outcome.alreadyApproved,
    };
  }

  /** The trail's route as [lng, lat] pairs; [] when it has none. */
  private async loadRoute(
    admin: AdminClient,
    trail: { id: string; route?: unknown },
  ): Promise<Array<[number, number]>> {
    const coordinates = parseRouteCoordinates(trail.route);
    if (coordinates.length > 0 || !trail.route) return coordinates;

    // Not GeoJSON (PostgREST may be configured to return WKB): let PostGIS convert it.
    const { data, error } = await admin.rpc('get_trail_route', {
      trail_uuid: trail.id,
    });
    if (error) {
      this.logger.warn(`Could not load a trail route: ${error.message}`);
      return [];
    }
    return parseRouteCoordinates(data);
  }

  private async createFromHike(
    admin: AdminClient,
    userId: string,
    trailId: string,
    verification: HikeVerificationResult,
    completedAt: string,
    elapsedSeconds: number | null,
  ): Promise<CompletionOutcome> {
    const status = verification.verified ? 'approved' : 'pending';

    const { data, error } = await admin
      .from('trail_completions')
      .insert({
        user_id: userId,
        trail_id: trailId,
        status,
        completed_at: completedAt,
        elapsed_seconds: elapsedSeconds,
        reviewer_note: verification.verified ? null : autoNote(verification),
      })
      .select()
      .single();

    if (error?.code === '23505') {
      // A concurrent request (double tap, offline sync) created it first.
      const { data: winner, error: winnerError } = await admin
        .from('trail_completions')
        .select('*')
        .eq('user_id', userId)
        .eq('trail_id', trailId)
        .maybeSingle();
      throwIfError(winnerError);
      if (winner) {
        return this.applyToExisting(
          admin,
          winner,
          verification,
          completedAt,
          elapsedSeconds,
        );
      }
    }
    throwIfError(error);

    return {
      row: data,
      approvedNow: status === 'approved',
      alreadyApproved: false,
    };
  }

  private async applyToExisting(
    admin: AdminClient,
    existing: CompletionRow,
    verification: HikeVerificationResult,
    completedAt: string,
    elapsedSeconds: number | null,
  ): Promise<CompletionOutcome> {
    if (existing.status === 'approved') {
      return { row: existing, approvedNow: false, alreadyApproved: true };
    }

    // A pending or rejected completion only changes when this attempt verifies.
    if (!verification.verified) {
      return { row: existing, approvedNow: false, alreadyApproved: false };
    }

    const { data, error } = await admin
      .from('trail_completions')
      .update({
        status: 'approved',
        reviewer_note: null,
        completed_at: completedAt,
        elapsed_seconds: elapsedSeconds,
      })
      .eq('id', existing.id)
      .neq('status', 'approved')
      .select()
      .maybeSingle();

    throwIfError(error);
    if (!data) {
      // Approved by someone else in the meantime
      return {
        row: { ...existing, status: 'approved' },
        approvedNow: false,
        alreadyApproved: true,
      };
    }
    return { row: data, approvedNow: true, alreadyApproved: false };
  }

  /** Best effort: a missing table (migration 048 not applied yet) or error is only logged. */
  private async storeHike(
    admin: AdminClient,
    hike: Record<string, unknown>,
  ): Promise<void> {
    try {
      const { error } = await admin.from('hikes').insert(hike);
      if (!error) return;

      if (isMissingRelationError(error)) {
        if (!this.missingHikesTableLogged) {
          this.missingHikesTableLogged = true;
          this.logger.warn(
            'The hikes table does not exist yet (migration 048); recorded tracks are not stored',
          );
        }
        return;
      }
      this.logger.warn(`Could not store a recorded hike: ${error.message}`);
    } catch (err) {
      this.logger.warn(
        `Could not store a recorded hike: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Keeps the profile counter and badges in step once a completion is approved. */
  private async onCompletionApproved(userId: string): Promise<string[]> {
    await this.syncCompletionCount(userId);
    return this.awardBadges(userId);
  }

  /**
   * Sets profiles.total_trails_completed to the user's number of approved completions.
   * An absolute recount cannot drift and repairs earlier drift. Failures are logged, not
   * thrown: the completion is already saved and the next recount fixes the counter.
   */
  async syncCompletionCount(userId: string): Promise<void> {
    const admin = this.supabaseService.getAdminClient();

    const { count, error } = await admin
      .from('trail_completions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'approved');

    if (error || typeof count !== 'number') {
      this.logger.error(
        `Could not count approved completions: ${error?.message ?? 'no count returned'}`,
      );
      return;
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update({ total_trails_completed: count })
      .eq('id', userId);

    if (updateError) {
      this.logger.error(
        `Could not update the completion counter: ${updateError.message}`,
      );
    }
  }

  /** Awards any badges the user now qualifies for and tells them. Never throws. */
  private async awardBadges(userId: string): Promise<string[]> {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin.rpc('check_and_award_badges', {
      p_user_id: userId,
    });

    if (error) {
      this.logger.error(`Badge check failed: ${error.message}`);
      return [];
    }

    const badgeIds = Array.isArray(data) ? (data as string[]) : [];
    if (badgeIds.length > 0) {
      this.notifyBadges(userId, badgeIds).catch((err: unknown) =>
        this.logger.warn(
          `Badge notification failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
    return badgeIds;
  }

  private async notifyBadges(userId: string, badgeIds: string[]) {
    const admin = this.supabaseService.getAdminClient();
    const { data: badges } = await admin
      .from('badges')
      .select('name_en')
      .in('id', badgeIds);

    const names =
      (badges ?? [])
        .map((b: { name_en?: string }) => b.name_en)
        .filter(Boolean)
        .join(', ') || 'a new badge';

    await this.notificationsService.sendToUser(
      userId,
      'Badge Earned!',
      `You earned: ${names}`,
      { badgeIds },
      'badge_earned',
    );
  }

  async deleteCompletion(userId: string, completionId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: completion, error: fetchError } = await admin
      .from('trail_completions')
      .select('id, user_id, status')
      .eq('id', completionId)
      .maybeSingle();

    throwIfError(fetchError);
    if (!completion) {
      throw new NotFoundException('Completion not found');
    }

    if (completion.user_id !== userId) {
      throw new BadRequestException('You can only delete your own completions');
    }

    const { error } = await admin
      .from('trail_completions')
      .delete()
      .eq('id', completionId);

    throwIfError(error);

    if (completion.status === 'approved') {
      await this.syncCompletionCount(userId);
    }

    return { deleted: true };
  }

  async getUserCompletions(userId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('trail_completions')
      .select(
        `
        *,
        trails:trail_id (id, name_en, name_ka, difficulty, region, cover_image_url, distance_km, elevation_gain_m, estimated_hours)
      `,
      )
      .eq('user_id', userId)
      .order('completed_at', { ascending: false });

    throwIfError(error);
    return data;
  }

  /** Public list: no proof photos, photo coordinates or reviewer notes. */
  async getTrailCompletions(trailId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('trail_completions')
      .select(
        `
        id,
        user_id,
        trail_id,
        completed_at,
        elapsed_seconds,
        profiles:user_id (id, username, avatar_url)
      `,
      )
      .eq('trail_id', trailId)
      .eq('status', 'approved')
      .order('completed_at', { ascending: false })
      .limit(PUBLIC_COMPLETIONS_LIMIT);

    throwIfError(error);
    return data ?? [];
  }

  async reviewCompletion(
    completionId: string,
    status: 'approved' | 'rejected',
    reviewerNote?: string,
  ) {
    const admin = this.supabaseService.getAdminClient();

    const { data: completion, error: fetchError } = await admin
      .from('trail_completions')
      .select('id, user_id, trail_id, status, trails:trail_id (name_en)')
      .eq('id', completionId)
      .maybeSingle();

    throwIfError(fetchError);
    if (!completion) {
      throw new NotFoundException('Completion not found');
    }

    if (completion.status !== 'pending') {
      throw new BadRequestException('Completion already reviewed');
    }

    const { data, error } = await admin
      .from('trail_completions')
      .update({
        status,
        ...(reviewerNote !== undefined ? { reviewer_note: reviewerNote } : {}),
      })
      .eq('id', completionId)
      .eq('status', 'pending')
      .select()
      .maybeSingle();

    throwIfError(error);
    if (!data) {
      throw new ConflictException('Completion already reviewed');
    }

    if (status !== 'approved') return data;

    const newBadgeIds = await this.onCompletionApproved(completion.user_id);

    const trailName = (completion.trails as { name_en?: string } | null)
      ?.name_en;
    void this.notificationsService.sendToUser(
      completion.user_id,
      'Hike approved',
      trailName
        ? `Your hike on ${trailName} was approved.`
        : 'Your hike was approved.',
      { completionId, trailId: completion.trail_id },
      'completion_approved',
    );

    return { ...data, new_badge_ids: newBadgeIds };
  }

  async markHikeActive(userId: string, trailId: string) {
    const admin = this.supabaseService.getAdminClient();
    const { error } = await admin
      .from('active_hikes')
      .upsert(
        { trail_id: trailId, user_id: userId },
        { onConflict: 'trail_id,user_id' },
      );
    throwIfError(error);
    return { active: true };
  }

  async markHikeInactive(userId: string, trailId: string) {
    const admin = this.supabaseService.getAdminClient();
    const { error } = await admin
      .from('active_hikes')
      .delete()
      .eq('trail_id', trailId)
      .eq('user_id', userId);
    throwIfError(error);
    return { active: false };
  }

  async getActiveCount(trailId: string) {
    const admin = this.supabaseService.getAdminClient();
    const { count, error } = await admin
      .from('active_hikes')
      .select('*', { count: 'exact', head: true })
      .eq('trail_id', trailId);
    throwIfError(error);
    return { count: count ?? 0 };
  }
}
