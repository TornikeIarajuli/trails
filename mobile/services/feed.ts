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

  /** Discover: everyone's posts (not your own), best first, shaped like the feed. */
  async getDiscover(page = 1, limit = 20): Promise<PaginatedResponse<FeedItem>> {
    const response = await api.get('/feed/discover', { params: { page, limit } });
    return response.data;
  },

  /** The posts you saved, most recently saved first, shaped like the feed. */
  async getSaved(page = 1, limit = 20): Promise<PaginatedResponse<FeedItem>> {
    const response = await api.get('/feed/saved', { params: { page, limit } });
    return response.data;
  },

  /** Saves a post for later; saving twice is fine. 404 when the post is gone. */
  async savePost(activityId: string): Promise<{ saved: boolean }> {
    const response = await api.put(`/feed/saved/${encodeURIComponent(activityId)}`);
    return response.data;
  },

  async unsavePost(activityId: string): Promise<{ saved: boolean }> {
    const response = await api.delete(`/feed/saved/${encodeURIComponent(activityId)}`);
    return response.data;
  },

  /** One post, shaped like a feed item. 404 when it was deleted or its author is blocked. */
  async getPost(activityId: string): Promise<FeedItem> {
    const response = await api.get(`/feed/activity/${encodeURIComponent(activityId)}`);
    return response.data;
  },
};
