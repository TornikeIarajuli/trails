import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EventsService {
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
    if (error) throw error;
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
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('events')
      .insert({ ...dto, organizer_id: organizerId })
      .select()
      .single();

    if (error) throw error;

    // Auto-join organizer
    await admin
      .from('event_participants')
      .insert({ event_id: data.id, user_id: organizerId })
      .select();

    return data;
  }

  async delete(userId: string, eventId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: event } = await admin
      .from('events')
      .select('organizer_id')
      .eq('id', eventId)
      .single();

    if (!event) throw new NotFoundException('Event not found');
    if (event.organizer_id !== userId) {
      throw new BadRequestException('Only the organizer can delete this event');
    }

    const { error } = await admin.from('events').delete().eq('id', eventId);
    if (error) throw error;
    return { deleted: true };
  }

  async join(userId: string, eventId: string) {
    const admin = this.supabaseService.getAdminClient();

    // Fetch event details (capacity check + organizer for notification)
    const { data: event } = await admin
      .from('events')
      .select('max_participants, organizer_id, title')
      .eq('id', eventId)
      .single();

    if (!event) throw new NotFoundException('Event not found');

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

    if (error) throw error;

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
          { eventId, userId },
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

    if (error) throw error;
    return { left: true };
  }
}
