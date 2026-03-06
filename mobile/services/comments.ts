import api from './api';
import { ActivityComment } from '../types/comment';

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
};
