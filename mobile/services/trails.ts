import api from './api';
import { Trail, TrailDetail, TrailMedia, NearbyTrail } from '../types/trail';
import { PaginatedResponse } from '../types/api';

// `null` clears an optional field; an omitted key leaves it unchanged.
export interface UpdateTrailData {
  name_en?: string;
  name_ka?: string | null;
  description_en?: string | null;
  description_ka?: string | null;
  difficulty?: string;
  region?: string;
  distance_km?: number | null;
  elevation_gain_m?: number | null;
  estimated_hours?: number | null;
  cover_image_url?: string | null;
  is_published?: boolean;
}

export interface TrailFilterParams {
  page?: number;
  limit?: number;
  difficulty?: string;
  region?: string;
  search?: string;
  min_distance?: number;
  max_distance?: number;
}

export const trailsService = {
  async getTrails(params?: TrailFilterParams): Promise<PaginatedResponse<Trail>> {
    const response = await api.get('/trails', { params });
    return response.data;
  },

  async getTrail(id: string): Promise<TrailDetail> {
    const response = await api.get(`/trails/${id}`);
    return response.data;
  },

  async getNearby(lat: number, lng: number, radiusKm?: number): Promise<NearbyTrail[]> {
    const response = await api.get('/trails/nearby', {
      params: { lat, lng, radius_km: radiusKm },
    });
    return response.data;
  },

  async getRecommendations(limit?: number): Promise<{
    data: (Trail & { avg_rating: number | null; review_count: number })[];
    target_difficulties: string[];
    user_stats: Record<string, number>;
    all_completed?: boolean;
  }> {
    const response = await api.get('/trails/recommendations', {
      params: { limit },
    });
    return response.data;
  },

  async getRegions(): Promise<string[]> {
    const response = await api.get('/trails/regions');
    return response.data;
  },

  async updateTrail(id: string, data: UpdateTrailData): Promise<Trail> {
    const response = await api.patch(`/trails/${id}`, data);
    return response.data;
  },

  async deleteTrailMedia(mediaId: string): Promise<void> {
    await api.delete(`/media/${mediaId}`);
  },
};
