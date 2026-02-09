import api from './api';
import { Checkpoint, CheckpointCompletion } from '../types/checkpoint';

export const checkpointsService = {
  async getByTrail(trailId: string): Promise<Checkpoint[]> {
    const response = await api.get(`/checkpoints/trail/${trailId}`);
    return response.data;
  },

  async submitCompletion(data: {
    checkpoint_id: string;
    proof_photo_url: string;
    photo_lat: number;
    photo_lng: number;
  }): Promise<CheckpointCompletion & { message: string }> {
    const response = await api.post('/checkpoints/complete', data);
    return response.data;
  },

  async getMyCompletions(): Promise<CheckpointCompletion[]> {
    const response = await api.get('/checkpoints/completions/me');
    return response.data;
  },

  async getMyTrailCompletions(trailId: string): Promise<CheckpointCompletion[]> {
    const response = await api.get(`/checkpoints/completions/me/${trailId}`);
    return response.data;
  },
};
