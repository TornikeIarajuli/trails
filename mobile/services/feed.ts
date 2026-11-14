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

  /** One post, shaped like a feed item. 404 when it was deleted or its author is blocked. */
  async getPost(activityId: string): Promise<FeedItem> {
    const response = await api.get(`/feed/activity/${encodeURIComponent(activityId)}`);
    return response.data;
  },
};
