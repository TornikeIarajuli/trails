import api from './api';
import { Trail } from '../types/trail';
import { PaginatedResponse } from '../types/api';

export type BookmarkCategory = 'saved' | 'want_to_hike' | 'in_progress' | 'favorites';

export interface BookmarkEntry {
  id: string;
  created_at: string;
  category: BookmarkCategory;
  note: string | null;
  trails: Trail;
}

export const CATEGORY_LABELS: Record<BookmarkCategory, string> = {
  saved: 'Saved',
  want_to_hike: 'Want to Hike',
  in_progress: 'In Progress',
  favorites: 'Favorites',
};

export const CATEGORY_ICONS: Record<BookmarkCategory, string> = {
  saved: 'bookmark',
  want_to_hike: 'flag',
  in_progress: 'walk',
  favorites: 'heart',
};

export const bookmarksService = {
  async toggle(trailId: string, category?: BookmarkCategory): Promise<{ bookmarked: boolean }> {
    const response = await api.post(`/bookmarks/${trailId}`, { category });
    return response.data;
  },

  async updateBookmark(
    trailId: string,
    data: { category?: BookmarkCategory; note?: string | null },
  ): Promise<{ updated: boolean }> {
    const response = await api.patch(`/bookmarks/${trailId}`, data);
    return response.data;
  },

  async getMyBookmarks(
    page = 1,
    limit = 20,
    category?: BookmarkCategory,
  ): Promise<PaginatedResponse<BookmarkEntry>> {
    const response = await api.get('/bookmarks', {
      params: { page, limit, category },
    });
    return response.data;
  },

  async isBookmarked(trailId: string): Promise<{
    bookmarked: boolean;
    category: BookmarkCategory | null;
    note: string | null;
  }> {
    const response = await api.get(`/bookmarks/check/${trailId}`);
    return response.data;
  },
};
