import api from './api';
import { UserProfile, PublicProfile, LeaderboardEntry } from '../types/user';

export const usersService = {
  async getMyProfile(): Promise<UserProfile> {
    const response = await api.get('/users/me');
    return response.data;
  },

  async updateProfile(data: {
    full_name?: string;
    bio?: string;
    avatar_url?: string;
  }): Promise<UserProfile> {
    const response = await api.patch('/users/me', data);
    return response.data;
  },

  async getLeaderboard(limit?: number): Promise<LeaderboardEntry[]> {
    const response = await api.get('/users/leaderboard', {
      params: { limit },
    });
    return response.data;
  },

  async searchUsers(query: string): Promise<{ id: string; username: string; full_name: string | null; avatar_url: string | null }[]> {
    const response = await api.get('/users/search', { params: { q: query } });
    return response.data;
  },

  async getPublicProfile(userId: string): Promise<PublicProfile> {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
};
