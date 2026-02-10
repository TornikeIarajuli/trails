import api from './api';
import { Badge, UserBadge } from '../types/badge';

export const badgesService = {
  async getAllBadges(): Promise<Badge[]> {
    const response = await api.get('/badges');
    return response.data;
  },

  async getMyBadges(): Promise<UserBadge[]> {
    const response = await api.get('/badges/me');
    return response.data;
  },

  async checkBadges(): Promise<{ new_badges: Badge[]; count: number }> {
    const response = await api.post('/badges/check');
    return response.data;
  },

  async getProgress(): Promise<{
    total_completions: number;
    completions_by_difficulty: Record<string, number>;
    completions_by_region: Record<string, number>;
    unique_regions: number;
  }> {
    const response = await api.get('/badges/progress');
    return response.data;
  },
};
