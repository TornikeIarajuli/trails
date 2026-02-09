import api from './api';
import { FollowUser, FollowCounts } from '../types/follow';
import { PaginatedResponse } from '../types/api';

export const followsService = {
  async toggle(userId: string): Promise<{ following: boolean }> {
    const response = await api.post(`/follows/${userId}`);
    return response.data;
  },

  async isFollowing(userId: string): Promise<{ following: boolean }> {
    const response = await api.get(`/follows/check/${userId}`);
    return response.data;
  },

  async getFollowers(userId: string, page = 1, limit = 20): Promise<PaginatedResponse<FollowUser>> {
    const response = await api.get(`/follows/followers/${userId}`, {
      params: { page, limit },
    });
    return response.data;
  },

  async getFollowing(userId: string, page = 1, limit = 20): Promise<PaginatedResponse<FollowUser>> {
    const response = await api.get(`/follows/following/${userId}`, {
      params: { page, limit },
    });
    return response.data;
  },

  async getCounts(userId: string): Promise<FollowCounts> {
    const response = await api.get(`/follows/counts/${userId}`);
    return response.data;
  },
};
