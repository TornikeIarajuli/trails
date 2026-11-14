import api from './api';

export interface TrailEvent {
  id: string;
  trail_id: string;
  organizer_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  max_participants: number | null;
  created_at: string;
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
