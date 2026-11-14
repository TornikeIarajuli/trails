import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { throwIfError } from '../common/supabase-error';
import { CheckInDto } from './dto/check-in.dto';

/** The earliest and latest a back-by time can be set to, from now. */
export const MIN_BACK_BY_MS = 10 * 60 * 1000;
export const MAX_BACK_BY_MS = 72 * 60 * 60 * 1000;

const OPEN = ['active', 'alerted'];

interface CheckInRow {
  id: string;
  trail_id: string | null;
  status: 'active' | 'alerted' | 'finished';
  back_by: string;
  started_at: string;
  reminded_at: string | null;
  alerted_at: string | null;
  last_position_at: string | null;
}

/**
 * "Back by" check-ins (migration 060). The app sets one when a hike starts, sends its position
 * now and then, and closes it when the hike ends. The database does the timing: at the back-by
 * time the hiker is asked "Are you back?", and half an hour later their emergency contact is
 * alerted. Closing a check-in after that tells the contact the hiker is back.
 */
@Injectable()
export class CheckinsService {
  private readonly logger = new Logger(CheckinsService.name);

  constructor(
    private supabaseService: SupabaseService,
    private notificationsService: NotificationsService,
  ) {}

  /** The open check-in (or null) and who would be alerted. */
  async get(userId: string) {
    const admin = this.supabaseService.getAdminClient();
    const [open, contact] = await Promise.all([
      this.findOpen(userId),
      this.emergencyContact(userId),
    ]);

    let trailName: string | null = null;
    if (open?.trail_id) {
      const { data } = await admin
        .from('trails')
        .select('name_en')
        .eq('id', open.trail_id)
        .maybeSingle();
      trailName = (data as { name_en?: string } | null)?.name_en ?? null;
    }

    return {
      check_in: open ? { ...open, trail_name: trailName } : null,
      emergency_contact: contact
        ? { id: contact.id, username: contact.username }
        : null,
    };
  }

  /**
   * Starts the check-in of the hike in progress, or updates it: a new back-by time, the latest
   * position. A check-in for another trail is closed first. Answering after the contact was
   * alerted tells them the hiker is fine.
   */
  async set(userId: string, dto: CheckInDto) {
    const backBy = new Date(dto.back_by);
    const now = Date.now();
    if (Number.isNaN(backBy.getTime())) {
      throw new BadRequestException('back_by must be a date and time');
    }
    if (backBy.getTime() < now + MIN_BACK_BY_MS) {
      throw new BadRequestException('Pick a time at least 10 minutes from now');
    }
    if (backBy.getTime() > now + MAX_BACK_BY_MS) {
      throw new BadRequestException('Pick a time within the next 3 days');
    }

    const contact = await this.emergencyContact(userId);
    if (!contact) {
      throw new BadRequestException(
        'Choose an emergency contact first: they are the one alerted if you are not back',
      );
    }

    const admin = this.supabaseService.getAdminClient();
    const open = await this.findOpen(userId);
    const position =
      dto.lat !== undefined && dto.lng !== undefined
        ? {
            last_lat: dto.lat,
            last_lng: dto.lng,
            last_position_at: new Date().toISOString(),
          }
        : {};

    if (open && open.trail_id === dto.trail_id) {
      // The hiker answered: they are fine. A contact who was alerted hears so.
      if (open.status === 'alerted') await this.tellContactBack(userId, true);
      const moved = new Date(open.back_by).getTime() !== backBy.getTime();
      const { data, error } = await admin
        .from('hike_checkins')
        .update({
          status: 'active',
          back_by: backBy.toISOString(),
          ...position,
          // A new time gets its own reminder
          ...(moved || open.status === 'alerted'
            ? { reminded_at: null, alerted_at: null }
            : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', open.id)
        .select()
        .single();
      throwIfError(error);
      return data;
    }

    if (open) await this.close(userId, open);

    const { data, error } = await admin
      .from('hike_checkins')
      .insert({
        user_id: userId,
        trail_id: dto.trail_id,
        back_by: backBy.toISOString(),
        ...position,
      })
      .select()
      .single();
    throwIfError(error);
    return data;
  }

  /**
   * The hiker is back: closes the open check-in; a contact who was alerted hears so. With a
   * trail, only that trail's check-in (a finish sent late, after the phone found signal again,
   * must not close the check-in of a later hike).
   */
  async finish(userId: string, trailId?: string) {
    const open = await this.findOpen(userId);
    if (!open) return { ok: true, closed: false };
    if (trailId && open.trail_id?.toLowerCase() !== trailId.toLowerCase()) {
      return { ok: true, closed: false };
    }
    await this.close(userId, open);
    return { ok: true, closed: true };
  }

  private async close(userId: string, open: CheckInRow) {
    const admin = this.supabaseService.getAdminClient();
    const { error } = await admin
      .from('hike_checkins')
      .update({
        status: 'finished',
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', open.id);
    throwIfError(error);
    if (open.status === 'alerted') await this.tellContactBack(userId, false);
  }

  private async findOpen(userId: string): Promise<CheckInRow | null> {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('hike_checkins')
      .select(
        'id, trail_id, status, back_by, started_at, reminded_at, alerted_at, last_position_at',
      )
      .eq('user_id', userId)
      .in('status', OPEN)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfError(error);
    return (data as CheckInRow | null) ?? null;
  }

  private async emergencyContact(
    userId: string,
  ): Promise<{ id: string; username: string } | null> {
    const admin = this.supabaseService.getAdminClient();
    const { data } = await admin
      .from('profiles')
      .select('emergency_contact_user_id')
      .eq('id', userId)
      .maybeSingle();
    const contactId = (data as { emergency_contact_user_id?: string } | null)
      ?.emergency_contact_user_id;
    if (!contactId) return null;
    const { data: contact } = await admin
      .from('profiles')
      .select('id, username')
      .eq('id', contactId)
      .maybeSingle();
    return (contact as { id: string; username: string } | null) ?? null;
  }

  /** "nino is back" (or "is fine and still hiking") for the contact who was alerted. */
  private async tellContactBack(userId: string, stillHiking: boolean) {
    try {
      const admin = this.supabaseService.getAdminClient();
      const [{ data: hiker }, contact] = await Promise.all([
        admin
          .from('profiles')
          .select('username')
          .eq('id', userId)
          .maybeSingle(),
        this.emergencyContact(userId),
      ]);
      if (!contact) return;
      const name =
        (hiker as { username?: string } | null)?.username ?? 'Your friend';
      await this.notificationsService.sendToUser(
        contact.id,
        stillHiking ? `${name} checked in` : `${name} is back`,
        stillHiking
          ? `${name} is fine and still on the hike, with a new time to be back.`
          : `${name} has finished their hike and checked in.`,
        { userId },
        'checkin_back',
      );
    } catch (err) {
      this.logger.warn(
        `Could not tell the emergency contact: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
