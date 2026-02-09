import api from './api';
import { FeedItem } from '../types/feed';
import { PaginatedResponse } from '../types/api';

export const feedService = {
  async getFeed(page = 1, limit = 20): Promise<PaginatedResponse<FeedItem>> {
    const response = await api.get('/feed', {
      params: { page, limit },
    });
    return response.data;
  },
};
