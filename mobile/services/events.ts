import api from './api';

/** Public: listed for everyone. Private: only for those with the link. */
export type EventVisibility = 'public' | 'private';

/** Day 2 onwards of a multi-day trip: a trail, or a day without one ("Rest day in Mestia"). */
export interface TripDay {
  day_number: number;
  trail_id: string | null;
  title: string | null;
  note: string | null;
  trails?: { id: string; name_en: string; region?: string | null; difficulty?: string | null } | null;
}

/** A further day as the form sends it. */
export interface TripDayInput {
  trail_id?: string;
  title?: string;
  note?: string;
}

/** A message in a trip's chat. */
export interface TripMessage {
  id: string;
  event_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
  /** Shown before the server has it (sending). */
  pending?: boolean;
}

export interface TrailEvent {
  id: string;
  trail_id: string;
  organizer_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  max_participants: number | null;
  created_at: string;
  /** Absent from older servers: public. */
  visibility?: EventVisibility;
  /** The further days (lists carry only their numbers). */
  days?: Pick<TripDay, 'day_number'>[] | TripDay[];
  organizer: { id: string; username: string; avatar_url: string | null } | null;
  /** Region, difficulty and cover come with the event lists (absent from older servers). */
  trails: {
    id: string;
    name_en: string;
    region?: string | null;
    difficulty?: string | null;
    cover_image_url?: string | null;
  } | null;
  participant_count?: [{ count: number }];
  /** Who has joined (event lists); used to mark the user's own events. */
  participants?: { user_id: string }[];
}

export interface EventDetail extends TrailEvent {
  days?: TripDay[];
  participants: {
    user_id: string;
    joined_at: string;
    profiles: { id: string; username: string; avatar_url: string | null };
  }[];
}

export const eventsService = {
  getTrailEvents: async (trailId: string): Promise<TrailEvent[]> => {
    const { data } = await api.get<TrailEvent[]>(`/events?trail_id=${trailId}`);
    return data;
  },

  /** Every upcoming group hike, on any trail, soonest first. */
  getUpcomingEvents: async (): Promise<TrailEvent[]> => {
    const { data } = await api.get<TrailEvent[]>('/events');
    return data;
  },

  /** Your trips and group hikes, public or private, until their last day. */
  getMyEvents: async (): Promise<TrailEvent[]> => {
    const { data } = await api.get<TrailEvent[]>('/events/mine');
    return data;
  },

  /** The trip's chat, newest first (the latest 100 messages). */
  getMessages: async (eventId: string): Promise<TripMessage[]> => {
    const { data } = await api.get<{ data: TripMessage[] }>(`/events/${eventId}/messages`, { params: { limit: 100 } });
    return data.data;
  },

  sendMessage: async (eventId: string, body: string): Promise<TripMessage> => {
    const { data } = await api.post<TripMessage>(`/events/${eventId}/messages`, { body });
    return data;
  },

  deleteMessage: async (eventId: string, messageId: string): Promise<void> => {
    await api.delete(`/events/${eventId}/messages/${messageId}`);
  },

  getEvent: async (id: string): Promise<EventDetail> => {
    const { data } = await api.get<EventDetail>(`/events/${id}`);
    return data;
  },

  createEvent: async (dto: {
    trail_id: string;
    title: string;
    description?: string;
    scheduled_at: string;
    max_participants?: number;
    visibility?: EventVisibility;
    days?: TripDayInput[];
  }): Promise<TrailEvent> => {
    const { data } = await api.post<TrailEvent>('/events', dto);
    return data;
  },

  deleteEvent: async (id: string): Promise<void> => {
    await api.delete(`/events/${id}`);
  },

  joinEvent: async (id: string): Promise<void> => {
    await api.post(`/events/${id}/join`);
  },

  leaveEvent: async (id: string): Promise<void> => {
    await api.delete(`/events/${id}/leave`);
  },
};
