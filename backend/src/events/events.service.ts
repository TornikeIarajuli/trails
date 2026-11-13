import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { throwIfError } from '../common/supabase-error';

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

    let query = admin
      .from('events')
      .select(
        `
        *,
        organizer:organizer_id (id, username, avatar_url),
        trails:trail_id (id, name_en),
        participant_count:event_participants(count)
      `,
      )
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });

    if (trailId) {
      query = query.eq('trail_id', trailId);
    }

    const { data, error } = await query;
    throwIfError(error);
    return data ?? [];
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
        )
      `,
      )
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Event not found');
    return data;
  }

  async create(
    organizerId: string,
    dto: {
      trail_id: string;
      title: string;
      description?: string;
      scheduled_at: string;
      max_participants?: number;
    },
  ) {
    assertInFuture(dto.scheduled_at);
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('events')
      .insert({ ...dto, organizer_id: organizerId })
      .select()
      .single();

    throwIfError(error);

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
    },
  ) {
    if (dto.scheduled_at !== undefined) assertInFuture(dto.scheduled_at);
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
      .update(dto)
      .eq('id', eventId)
      .select()
      .single();

    throwIfError(error);

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
