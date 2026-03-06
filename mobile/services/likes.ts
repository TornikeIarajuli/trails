import api from './api';

export interface ActivityLike {
  id: string;
  user_id: string;
  created_at: string;
}

export const likesService = {
  getLikes: async (activityId: string): Promise<ActivityLike[]> => {
    const response = await api.get(`/comments/likes/${activityId}`);
    return response.data;
  },

  toggleLike: async (data: {
    activity_id: string;
    activity_type: string;
  }): Promise<{ liked: boolean; count: number }> => {
    const response = await api.post('/comments/likes/toggle', data);
    return response.data;
  },
};
