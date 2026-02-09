import api from './api';
import { Trail } from '../types/trail';
import { PaginatedResponse } from '../types/api';

export interface BookmarkEntry {
  id: string;
  created_at: string;
  trails: Trail;
}

export const bookmarksService = {
  async toggle(trailId: string): Promise<{ bookmarked: boolean }> {
    const response = await api.post(`/bookmarks/${trailId}`);
    return response.data;
  },

  async getMyBookmarks(page = 1, limit = 20): Promise<PaginatedResponse<BookmarkEntry>> {
    const response = await api.get('/bookmarks', { params: { page, limit } });
    return response.data;
  },

  async isBookmarked(trailId: string): Promise<{ bookmarked: boolean }> {
    const response = await api.get(`/bookmarks/check/${trailId}`);
    return response.data;
  },
};
