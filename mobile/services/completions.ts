import api from './api';
import { Config } from '../constants/config';
import {
  PastHikeResponse,
  RecordHikePayload,
  RecordHikeResponse,
  TrailCompletion,
} from '../types/completion';

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

  async recordHike(payload: RecordHikePayload): Promise<RecordHikeResponse> {
    // A finished hike is worth waiting for a waking server rather than falling back to the offline queue
    const response = await api.post('/completions/record', payload, {
      timeout: Config.COLD_START_TIMEOUT_MS,
    });
    return response.data;
  },

  /** Marks a trail as done for a hike from before the app; only the year is recorded. */
  async logPastHike(trailId: string, year: number): Promise<PastHikeResponse> {
    // Often the first request after the server has been idle; not worth failing over a slow wake-up
    const response = await api.post(
      '/completions/past',
      { trail_id: trailId, year },
      { timeout: Config.COLD_START_TIMEOUT_MS },
    );
    return response.data;
  },

  async deleteCompletion(id: string): Promise<void> {
    await api.delete(`/completions/${id}`);
  },

  async markActive(trailId: string): Promise<void> {
    await api.post(`/completions/active/${trailId}`);
  },

  async clearActive(trailId: string): Promise<void> {
    await api.delete(`/completions/active/${trailId}`);
  },
};
