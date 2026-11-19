import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { throwIfError } from '../common/supabase-error';
import type { EventDayDto, EventVisibility } from './dto/trip.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
/** A chat notification shows this much of the message. */
const MESSAGE_PREVIEW = 120;

/** What the event lists select: the trail's picture, region and difficulty, who joined, how many days. */
const LIST_COLUMNS = `
        *,
        organizer:organizer_id (id, username, avatar_url),
        trails:trail_id (id, name_en, region, difficulty, cover_image_url),
        participant_count:event_participants(count),
        participants:event_participants(user_id),
        days:event_days(day_number)
      `;

export interface DayRow {
  day_number: number;
}

/** The last day of a trip: day 1 plus its further days. */
function lastDayStart(event: { scheduled_at: string; days?: DayRow[] | null }) {
  const extra = Math.max(0, ...(event.days ?? []).map((d) => d.day_number - 1));
  return Date.parse(event.scheduled_at) + extra * DAY_MS;
}

function assertInFuture(scheduledAt: string) {
  const time = Date.parse(scheduledAt);
  if (Number.isNaN(time) || time <= Date.now()) {
    throw new BadRequestException('scheduled_at must be in the future');
  }
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private supabaseService: SupabaseService,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(trailId?: string) {
    const admin = this.supabaseService.getAdminClient();

    // Private trips are only for those with the link (and in their own list, findMine)
    let query = admin
      .from('events')
      // The trail's picture, region and difficulty and who has joined let the app show the
      // list as cards with a "Joined" mark, without opening each event
      .select(LIST_COLUMNS)
      .eq('visibility', 'public')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });

    if (trailId) {
      query = query.eq('trail_id', trailId);
    }

    const { data, error } = await query;
    throwIfError(error);
    return data ?? [];
  }

  /**
   * Your trips and group hikes, public or private, that have not ended yet (a multi-day trip
   * counts until its last day), soonest first.
   */
  async findMine(userId: string) {
    const admin = this.supabaseService.getAdminClient();
    const { data: joined, error: joinedError } = await admin
      .from('event_participants')
      .select('event_id')
      .eq('user_id', userId);
    throwIfError(joinedError);
    const ids = (joined ?? []).map((row: { event_id: string }) => row.event_id);
    if (ids.length === 0) return [];

    const { data, error } = await admin
      .from('events')
      .select(LIST_COLUMNS)
      .in('id', ids)
      .gte('scheduled_at', new Date(Date.now() - 14 * DAY_MS).toISOString())
      .order('scheduled_at', { ascending: true });
    throwIfError(error);
    const now = Date.now();
    return (
      (data ?? []) as Array<{ scheduled_at: string; days?: DayRow[] }>
    ).filter((event) => lastDayStart(event) + DAY_MS > now);
  }

  async findOne(id: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('events')
      .select(
        `
        *,
        organizer:organizer_id (id, username, avatar_url),
        trails:trail_id (id, name_en, difficulty, region),
        participants:event_participants (
          user_id,
          joined_at,
          profiles:user_id (id, username, avatar_url)
        ),
        days:event_days (
          day_number,
          trail_id,
          title,
          note,
          trails:trail_id (id, name_en, region, difficulty)
        )
      `,
      )
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Event not found');
    const event = data as { days?: DayRow[] | null };
    return {
      ...data,
      days: [...(event.days ?? [])].sort((a, b) => a.day_number - b.day_number),
    };
  }

  /** Checks the further days of a trip: each has a trail that exists, or a title. */
  private async checkDays(days: EventDayDto[]) {
    if (days.some((d) => !d.trail_id && !d.title)) {
      throw new BadRequestException('Each day needs a trail or a title');
    }
    const trailIds = [
      ...new Set(
        days.map((d) => d.trail_id).filter((id): id is string => !!id),
      ),
    ];
    if (trailIds.length === 0) return;
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('trails')
      .select('id')
      .in('id', trailIds);
    throwIfError(error);
    if ((data ?? []).length !== trailIds.length) {
      throw new BadRequestException('Trail not found');
    }
  }

  /** Stores a trip's further days (day 2 onwards), replacing what was there. */
  private async saveDays(eventId: string, days: EventDayDto[]) {
    const admin = this.supabaseService.getAdminClient();
    const { error: deleteError } = await admin
      .from('event_days')
      .delete()
      .eq('event_id', eventId);
    throwIfError(deleteError);
    if (days.length === 0) return;
    const { error } = await admin.from('event_days').insert(
      days.map((day, i) => ({
        event_id: eventId,
        day_number: i + 2,
        trail_id: day.trail_id ?? null,
        title: day.title ?? null,
        note: day.note ?? null,
      })),
    );
    throwIfError(error);
  }

  async create(
    organizerId: string,
    dto: {
      trail_id: string;
      title: string;
      description?: string;
      scheduled_at: string;
      max_participants?: number;
      visibility?: EventVisibility;
      days?: EventDayDto[];
    },
  ) {
    assertInFuture(dto.scheduled_at);
    const { days, ...fields } = dto;
    if (days?.length) await this.checkDays(days);
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('events')
      .insert({ ...fields, organizer_id: organizerId })
      .select()
      .single();

    throwIfError(error);
    if (days?.length) await this.saveDays(data.id, days);

    // Auto-join organizer
    await admin
      .from('event_participants')
      .insert({ event_id: data.id, user_id: organizerId })
      .select();

    return data;
  }

  async update(
    userId: string,
    eventId: string,
    dto: {
      title?: string;
      description?: string;
      scheduled_at?: string;
      max_participants?: number;
      visibility?: EventVisibility;
      days?: EventDayDto[];
    },
  ) {
    if (dto.scheduled_at !== undefined) assertInFuture(dto.scheduled_at);
    const { days, ...fields } = dto;
    if (days?.length) await this.checkDays(days);
    const admin = this.supabaseService.getAdminClient();

    const { data: event } = await admin
      .from('events')
      .select('organizer_id, trail_id, title, scheduled_at')
      .eq('id', eventId)
      .single();

    if (!event) throw new NotFoundException('Event not found');
    if (event.organizer_id !== userId) {
      throw new BadRequestException('Only the organizer can edit this event');
    }

    const { data, error } = await admin
      .from('events')
      .update(fields)
      .eq('id', eventId)
      .select()
      .single();

    throwIfError(error);
    if (days !== undefined) await this.saveDays(eventId, days);

    const timeChanged =
      dto.scheduled_at !== undefined &&
      Date.parse(dto.scheduled_at) !== Date.parse(event.scheduled_at);
    if (timeChanged) {
      this.notifyParticipants(
        eventId,
        event.organizer_id,
        'Group hike rescheduled',
        `"${data?.title ?? event.title}" has a new date and time.`,
        { eventId, trailId: event.trail_id, cancelled: false },
      );
    }

    return data;
  }

  async delete(userId: string, eventId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: event } = await admin
      .from('events')
      .select('organizer_id, trail_id, title, scheduled_at')
      .eq('id', eventId)
      .single();

    if (!event) throw new NotFoundException('Event not found');
    if (event.organizer_id !== userId) {
      throw new BadRequestException('Only the organizer can delete this event');
    }

    // Read the participants first: deleting the event removes them.
    const participantIds =
      Date.parse(event.scheduled_at) > Date.now()
        ? await this.participantIds(eventId, event.organizer_id)
        : [];

    const { error } = await admin.from('events').delete().eq('id', eventId);
    throwIfError(error);

    this.sendToEach(
      participantIds,
      'Group hike cancelled',
      `"${event.title}" was cancelled by the organizer.`,
      { eventId, trailId: event.trail_id, cancelled: true },
    );

    return { deleted: true };
  }

  /** Participants other than the organizer; [] when they cannot be read. */
  private async participantIds(
    eventId: string,
    organizerId: string,
  ): Promise<string[]> {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('event_participants')
      .select('user_id')
      .eq('event_id', eventId);

    if (error) {
      this.logger.warn(`Could not load event participants: ${error.message}`);
      return [];
    }
    return (data ?? [])
      .map((p: { user_id: string }) => p.user_id)
      .filter((id) => id !== organizerId);
  }

  /** Fire-and-forget event_update push to everyone who joined. */
  private notifyParticipants(
    eventId: string,
    organizerId: string,
    title: string,
    body: string,
    data: Record<string, unknown>,
  ) {
    this.participantIds(eventId, organizerId)
      .then((ids) => this.sendToEach(ids, title, body, data))
      .catch(() => {});
  }

  private sendToEach(
    userIds: string[],
    title: string,
    body: string,
    data: Record<string, unknown>,
  ) {
    for (const id of userIds) {
      this.notificationsService
        .sendToUser(id, title, body, data, 'event_update')
        .catch(() => {});
    }
  }

  async join(userId: string, eventId: string) {
    const admin = this.supabaseService.getAdminClient();

    // Fetch event details (capacity check + organizer for notification)
    const { data: event } = await admin
      .from('events')
      .select('max_participants, organizer_id, title, trail_id, scheduled_at')
      .eq('id', eventId)
      .single();

    if (!event) throw new NotFoundException('Event not found');

    if (Date.parse(event.scheduled_at) <= Date.now()) {
      throw new BadRequestException('This group hike has already taken place');
    }

    if (event.max_participants) {
      const { count } = await admin
        .from('event_participants')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId);
      if ((count ?? 0) >= event.max_participants) {
        throw new BadRequestException('Event is full');
      }
    }

    const { error } = await admin
      .from('event_participants')
      .upsert(
        { event_id: eventId, user_id: userId },
        { onConflict: 'event_id,user_id' },
      );

    throwIfError(error);

    // Notify the organizer (skip if the organizer is joining their own event)
    if (event.organizer_id && event.organizer_id !== userId) {
      const { data: joinerProfile } = await admin
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single();
      const username = joinerProfile?.username ?? 'Someone';
      this.notificationsService
        .sendToUser(
          event.organizer_id,
          'New Participant',
          `${username} joined your event: ${event.title}`,
          { eventId, trailId: event.trail_id, userId },
          'event_invite',
        )
        .catch(() => {}); // fire-and-forget
    }

    return { joined: true };
  }

  /** The trip, for its chat: 404 when it is gone, 403 for someone who has not joined it. */
  private async assertParticipant(userId: string, eventId: string) {
    const admin = this.supabaseService.getAdminClient();
    const { data: event, error } = await admin
      .from('events')
      .select('id, title, organizer_id, trail_id')
      .eq('id', eventId)
      .maybeSingle();
    throwIfError(error);
    if (!event) throw new NotFoundException('Event not found');

    const { data: member, error: memberError } = await admin
      .from('event_participants')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();
    throwIfError(memberError);
    if (!member) {
      throw new ForbiddenException(
        'Join the trip to read and write in its chat',
      );
    }
    return event as {
      id: string;
      title: string;
      organizer_id: string;
      trail_id: string;
    };
  }

  /** The trip's chat, newest first, a page at a time (`before` an older message's time). */
  async listMessages(
    userId: string,
    eventId: string,
    before?: string,
    limit = 50,
  ) {
    await this.assertParticipant(userId, eventId);
    let query = this.supabaseService
      .getAdminClient()
      .from('event_messages')
      .select(
        'id, event_id, user_id, body, created_at, profiles:user_id (username, avatar_url)',
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (before) query = query.lt('created_at', before);
    const { data, error } = await query;
    throwIfError(error);
    return { data: data ?? [] };
  }

  /** Writes in the trip's chat and lets the others know (push only; the chat keeps it). */
  async postMessage(userId: string, eventId: string, body: string) {
    const event = await this.assertParticipant(userId, eventId);
    const admin = this.supabaseService.getAdminClient();
    const { data, error } = await admin
      .from('event_messages')
      .insert({ event_id: eventId, user_id: userId, body })
      .select(
        'id, event_id, user_id, body, created_at, profiles:user_id (username, avatar_url)',
      )
      .single();
    throwIfError(error);

    this.notifyChat(event, userId, body, (data as { id: string }).id).catch(
      () => {},
    );
    return data;
  }

  private async notifyChat(
    event: {
      id: string;
      title: string;
      organizer_id: string;
      trail_id: string;
    },
    authorId: string,
    body: string,
    messageId: string,
  ) {
    const admin = this.supabaseService.getAdminClient();
    const [{ data: members }, { data: author }] = await Promise.all([
      admin
        .from('event_participants')
        .select('user_id')
        .eq('event_id', event.id),
      admin.from('profiles').select('username').eq('id', authorId).single(),
    ]);
    const name =
      (author as { username?: string } | null)?.username ?? 'Someone';
    const text =
      body.length > MESSAGE_PREVIEW
        ? `${body.slice(0, MESSAGE_PREVIEW - 1)}…`
        : body;
    for (const member of (members ?? []) as { user_id: string }[]) {
      if (member.user_id === authorId) continue;
      this.notificationsService
        .sendToUser(
          member.user_id,
          event.title,
          `${name}: ${text}`,
          { eventId: event.id, trailId: event.trail_id, messageId },
          'group_chat',
          { history: false },
        )
        .catch(() => {});
    }
  }

  /** Deletes a chat message: its author, or the trip's organizer. */
  async deleteMessage(userId: string, eventId: string, messageId: string) {
    const event = await this.assertParticipant(userId, eventId);
    const admin = this.supabaseService.getAdminClient();
    const { data: message, error } = await admin
      .from('event_messages')
      .select('id, user_id')
      .eq('id', messageId)
      .eq('event_id', eventId)
      .maybeSingle();
    throwIfError(error);
    if (!message) throw new NotFoundException('Message not found');
    if (
      (message as { user_id: string }).user_id !== userId &&
      event.organizer_id !== userId
    ) {
      throw new ForbiddenException(
        'Only its author or the organizer can delete a message',
      );
    }
    const { error: deleteError } = await admin
      .from('event_messages')
      .delete()
      .eq('id', messageId);
    throwIfError(deleteError);
    return { deleted: true };
  }

  async leave(userId: string, eventId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { error } = await admin
      .from('event_participants')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);

    throwIfError(error);
    return { left: true };
  }
}
