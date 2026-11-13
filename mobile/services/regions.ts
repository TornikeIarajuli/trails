import api from './api';
import { RegionProgressResponse } from '../types/regions';

export const regionsService = {
  /** Completed trails per region for the signed-in user, or for `userId`. */
  async getRegionProgress(userId?: string): Promise<RegionProgressResponse> {
    const response = await api.get(userId ? `/users/${userId}/regions` : '/users/me/regions');
    return response.data;
  },
};
