import api from './api';
import { ActivityComment } from '../types/comment';

export interface PaginatedComments {
  data: ActivityComment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const commentsService = {
  getComments: async (
    activityId: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedComments> => {
    const response = await api.get(`/comments/${activityId}`, {
      params: { page, limit },
    });
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
