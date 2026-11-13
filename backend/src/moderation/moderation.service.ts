import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import {
  isMissingRelationError,
  SupabaseErrorLike,
  throwIfError,
} from '../common/supabase-error';
import { isLooseUuid } from '../common/validators/is-loose-uuid';
import { ReportContentDto } from './dto/report-content.dto';

/**
 * Reports and blocks (contract C9). The tables come from migration 050; until it is
 * applied, reads behave as if nobody blocked anyone and writes answer 503.
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private missingTablesLogged = false;

  constructor(private supabaseService: SupabaseService) {}

  private tablesMissing(error: SupabaseErrorLike | null): boolean {
    if (!isMissingRelationError(error)) return false;
    if (!this.missingTablesLogged) {
      this.missingTablesLogged = true;
      this.logger.warn(
        'Moderation tables do not exist yet (migration 050); reports and blocks are unavailable',
      );
    }
    return true;
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException(
      'This feature is not available yet. Please try again later.',
    );
  }

  async report(reporterId: string, dto: ReportContentDto) {
    const { error } = await this.supabaseService
      .getAdminClient()
      .from('content_reports')
      .insert({
        reporter_id: reporterId,
        target_type: dto.target_type,
        target_id: dto.target_id,
        reason: dto.reason,
        details: dto.details ?? null,
      });

    // Reporting the same thing twice is a no-op success
    if (error && error.code !== '23505') {
      if (this.tablesMissing(error)) throw this.unavailable();
      throwIfError(error);
    }
    return { reported: true };
  }

  /** Ids of the users `userId` has blocked; [] when that cannot be read. */
  async getBlockedUserIds(userId: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabaseService
        .getAdminClient()
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', userId);

      if (error) {
        if (!this.tablesMissing(error)) {
          this.logger.warn(`Could not load blocked users: ${error.message}`);
        }
        return [];
      }
      return (data ?? []).map((row: { blocked_id: string }) => row.blocked_id);
    } catch (err) {
      this.logger.warn(
        `Could not load blocked users: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  /** True when either user has blocked the other; false when that cannot be read. */
  async isBlockedEitherWay(userA: string, userB: string): Promise<boolean> {
    // Both ids go into a PostgREST filter string
    if (!isLooseUuid(userA) || !isLooseUuid(userB)) return false;

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('user_blocks')
      .select('blocker_id')
      .or(
        `and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`,
      )
      .limit(1);

    if (error) {
      if (!this.tablesMissing(error)) {
        this.logger.warn(`Could not check blocks: ${error.message}`);
      }
      return false;
    }
    return (data ?? []).length > 0;
  }

  async listBlocks(userId: string) {
    return { blocked_user_ids: await this.getBlockedUserIds(userId) };
  }

  /** Blocks `blockedId` and removes any follow between the two users. */
  async block(blockerId: string, blockedId: string) {
    if (blockerId.toLowerCase() === blockedId.toLowerCase()) {
      throw new BadRequestException('You cannot block yourself');
    }

    const admin = this.supabaseService.getAdminClient();

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id')
      .eq('id', blockedId)
      .maybeSingle();
    throwIfError(targetError);
    if (!target) throw new NotFoundException('User not found');

    const { error } = await admin
      .from('user_blocks')
      .upsert(
        { blocker_id: blockerId, blocked_id: target.id as string },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
      );
    if (error) {
      if (this.tablesMissing(error)) throw this.unavailable();
      throwIfError(error);
    }

    const { error: unfollowError } = await admin
      .from('user_follows')
      .delete()
      .or(
        `and(follower_id.eq.${blockerId},following_id.eq.${target.id}),and(follower_id.eq.${target.id},following_id.eq.${blockerId})`,
      );
    throwIfError(unfollowError);

    return { blocked: true };
  }

  async unblock(blockerId: string, blockedId: string) {
    const { error } = await this.supabaseService
      .getAdminClient()
      .from('user_blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);

    if (error) {
      if (this.tablesMissing(error)) throw this.unavailable();
      throwIfError(error);
    }
    return { blocked: false };
  }
}
