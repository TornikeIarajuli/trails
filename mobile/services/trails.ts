import api from './api';
import { Trail, TrailDetail, TrailMedia, NearbyTrail } from '../types/trail';
import { PaginatedResponse } from '../types/api';

export interface UpdateTrailData {
  name_en?: string;
  name_ka?: string;
  description_en?: string;
  description_ka?: string;
  difficulty?: string;
  region?: string;
  distance_km?: number;
  elevation_gain_m?: number;
  estimated_hours?: number;
  cover_image_url?: string;
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
