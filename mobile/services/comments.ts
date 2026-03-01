import api from './api';
import { ActivityComment } from '../types/comment';

export interface ActivityLike {
  id: string;
  user_id: string;
  created_at: string;
}

export const commentsService = {
  getComments: async (activityId: string): Promise<ActivityComment[]> => {
    const response = await api.get(`/comments/${activityId}`);
    return response.data;
  },

  addComment: async (data: {
    activity_id: string;
    activity_type: string;
    comment: string;
  }): Promise<ActivityComment> => {
    const response = await api.post('/comments', data);
    return response.data;
  },

  deleteComment: async (id: string): Promise<void> => {
    await api.delete(`/comments/${id}`);
  },

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
