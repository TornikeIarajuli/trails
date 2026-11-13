import api from './api';
import { TrailCondition, TrailPhoto, ConditionType, SeverityLevel } from '../types/community';
import { PaginatedResponse } from '../types/api';

export const communityService = {
  // ---- Conditions ----

  async reportCondition(data: {
    trail_id: string;
    condition_type: ConditionType;
    severity: SeverityLevel;
    description?: string;
    photo_url?: string;
  }): Promise<TrailCondition> {
    const response = await api.post('/community/conditions', data);
    return response.data;
  },

  async getTrailConditions(trailId: string): Promise<TrailCondition[]> {
    const response = await api.get(`/community/conditions/${trailId}`);
    return response.data;
  },

  async deactivateCondition(id: string): Promise<void> {
    await api.delete(`/community/conditions/${id}`);
  },

  // ---- Photos ----
  // Photos are created by the upload itself (mediaService.uploadHikePhoto), which
  // inserts the row server-side; there is deliberately no separate "create" call here.

  async getTrailPhotos(trailId: string, page = 1, limit = 20): Promise<PaginatedResponse<TrailPhoto>> {
    const response = await api.get(`/community/photos/${trailId}`, {
      params: { page, limit },
    });
    return response.data;
  },

  async toggleLike(photoId: string): Promise<{ liked: boolean; likes_count: number }> {
    const response = await api.post(`/community/photos/${photoId}/like`);
    return response.data;
  },

  async deletePhoto(id: string): Promise<void> {
    await api.delete(`/community/photos/${id}`);
  },
};
