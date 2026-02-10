import api from './api';
import { TrailCompletion } from '../types/completion';

export const completionsService = {
  async submit(data: {
    trail_id: string;
    proof_photo_url: string;
    photo_lat: number;
    photo_lng: number;
  }): Promise<TrailCompletion & { auto_approved: boolean; message: string }> {
    const response = await api.post('/completions', data);
    return response.data;
  },

  async getMyCompletions(): Promise<TrailCompletion[]> {
    const response = await api.get('/completions/me');
    return response.data;
  },

  async getTrailCompletions(trailId: string): Promise<TrailCompletion[]> {
    const response = await api.get(`/completions/trail/${trailId}`);
    return response.data;
  },

  async recordHike(trailId: string, elapsedSeconds?: number): Promise<TrailCompletion> {
    const response = await api.post('/completions/record', {
      trail_id: trailId,
      elapsed_seconds: elapsedSeconds,
    });
    return response.data;
  },

  async deleteCompletion(id: string): Promise<void> {
    await api.delete(`/completions/${id}`);
  },
};
