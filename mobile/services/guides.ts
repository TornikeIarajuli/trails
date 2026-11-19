import api from './api';

export type GuideStatus = 'pending' | 'verified' | 'rejected' | 'paused';
export type BookingStatus = 'requested' | 'accepted' | 'declined' | 'cancelled';

/** A verified guide as anyone sees them (no phone or messengers). */
export interface Guide {
  user_id: string;
  headline: string;
  bio: string;
  regions: string[];
  languages: string[];
  certifications: string | null;
  price_gel: number | null;
  price_note: string | null;
  trail_ids: string[];
  verified_at: string | null;
  profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
}

export interface GuideTrail {
  id: string;
  name_en: string;
  region: string | null;
  difficulty: string | null;
}

export interface GuideDetail extends Guide {
  trails: GuideTrail[];
}

/** Your own guide profile, with its status and contact details. */
export interface MyGuideProfile extends GuideDetail {
  status: GuideStatus;
  admin_note: string | null;
  contact_phone: string | null;
  contact_whatsapp: boolean;
  contact_telegram: string | null;
}

export interface GuideProfileInput {
  headline: string;
  bio: string;
  regions: string[];
  languages: string[];
  certifications: string | null;
  price_gel: number | null;
  price_note: string | null;
  contact_phone: string | null;
  contact_whatsapp: boolean;
  contact_telegram: string | null;
  trail_ids: string[];
  active?: boolean;
}

/** Shared once the guide accepted your request. */
export interface GuideContact {
  phone: string | null;
  whatsapp_url: string | null;
  telegram: string | null;
  telegram_url: string | null;
}

export interface Booking {
  id: string;
  guide_id: string;
  hiker_id: string;
  trail_id: string | null;
  start_date: string;
  days: number;
  group_size: number;
  message: string;
  status: BookingStatus;
  guide_reply: string | null;
  created_at: string;
  trails: { id: string; name_en: string } | null;
  /** On your requests: the guide. */
  guide?: { headline: string; profiles: { username: string; avatar_url: string | null } | null } | null;
  /** On requests to you: the hiker. */
  hiker?: { username: string; avatar_url: string | null } | null;
}

export interface BookingInput {
  guide_id: string;
  trail_id?: string;
  start_date: string;
  days: number;
  group_size: number;
  message: string;
}

export const guidesService = {
  async list(params: { region?: string; trail_id?: string } = {}): Promise<Guide[]> {
    const response = await api.get('/guides', { params });
    return response.data;
  },

  /** 404 when they are not a verified guide. */
  async get(userId: string): Promise<GuideDetail> {
    const response = await api.get(`/guides/${encodeURIComponent(userId)}`);
    return response.data;
  },

  /** null when you never applied. */
  async getMine(): Promise<MyGuideProfile | null> {
    const response = await api.get('/guides/me');
    return response.data || null;
  },

  async saveMine(input: GuideProfileInput): Promise<MyGuideProfile> {
    const response = await api.put('/guides/me', input);
    return response.data;
  },

  /** 403 until the guide accepted one of your requests. */
  async contact(userId: string): Promise<GuideContact> {
    const response = await api.get(`/guides/${encodeURIComponent(userId)}/contact`);
    return response.data;
  },

  async bookings(): Promise<{ as_hiker: Booking[]; as_guide: Booking[] }> {
    const response = await api.get('/bookings');
    return response.data;
  },

  async requestBooking(input: BookingInput): Promise<Booking> {
    const response = await api.post('/bookings', input);
    return response.data;
  },

  async answerBooking(id: string, status: 'accepted' | 'declined' | 'cancelled', reply?: string): Promise<Booking> {
    const response = await api.patch(`/bookings/${encodeURIComponent(id)}`, { status, ...(reply ? { reply } : {}) });
    return response.data;
  },
};
