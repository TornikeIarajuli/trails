import api from './api';
import { UserProfile, PublicProfile, LeaderboardEntry, SosResult } from '../types/user';

export const usersService = {
  async getMyProfile(): Promise<UserProfile> {
    const response = await api.get('/users/me');
    return response.data;
  },

  async updateProfile(data: {
    full_name?: string;
    bio?: string;
    avatar_url?: string;
    contact_info?: string | null;
    instagram_handle?: string | null;
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

  async heartbeat(): Promise<void> {
    await api.patch('/users/me/heartbeat');
  },

  async setEmergencyContact(contactUserId: string | null): Promise<void> {
    await api.patch('/users/me/emergency-contact', { contact_user_id: contactUserId });
  },

  async getMyEmergencyContactId(): Promise<string | null> {
    const response = await api.get('/users/me');
    return (response.data.emergency_contact_user_id as string | null) ?? null;
  },

  async exportMyData(): Promise<Record<string, unknown>> {
    const response = await api.get('/users/me/export');
    return response.data;
  },

  async deleteAccount(): Promise<void> {
    await api.delete('/users/me');
  },

  /** Alerts the emergency contact. A 2xx alone does not mean anyone was reached — check `sent`. */
  async sendSos(lat: number, lng: number): Promise<SosResult> {
    const response = await api.post('/users/me/sos', { lat, lng });
    return response.data;
  },
};
