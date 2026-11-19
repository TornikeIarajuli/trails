import api from './api';
import type { TrailDifficulty } from '../types/trail';

export interface OutlookTrail {
  id: string;
  name_en: string;
  name_ka: string | null;
  region: string | null;
  difficulty: TrailDifficulty | null;
  cover_image_url: string | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
}

/** A trail's first good hiking day ahead, from the daily outlook (forecast at its highest point). */
export interface GoodDay {
  trail_id: string;
  /** YYYY-MM-DD, Georgian date. */
  day: string;
  verdict: 'go';
  /** "Go", "Go early", "Go after 11:00"... as on the trail page. */
  label: string;
  /** "Dry and calm", or what spoils the rest of the day. */
  headline: string;
  temp_min_c: number | null;
  temp_max_c: number | null;
  trail: OutlookTrail;
}

export const outlookService = {
  /** Per trail its first good day, today to `days - 1` days out, by day then name. */
  async goodDays(days = 3, limit = 100): Promise<GoodDay[]> {
    const response = await api.get('/outlook', { params: { days, limit } });
    return response.data?.data ?? [];
  },
};
