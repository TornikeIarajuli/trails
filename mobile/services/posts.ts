import api from './api';
import { FeedItem } from '../types/feed';

export const MAX_POST_LENGTH = 2000;
export const MAX_POST_PHOTOS = 6;
export const MAX_PLACE_LENGTH = 80;

export interface PostInput {
  body: string;
  trail_id: string | null;
  place_name: string | null;
  photo_urls: string[];
}

/** Free-form posts. Each answer is the post shaped like a feed item. */
export const postsService = {
  async create(input: PostInput): Promise<FeedItem> {
    const { trail_id, ...rest } = input;
    const response = await api.post('/posts', trail_id ? input : rest);
    return response.data;
  },

  async update(postId: string, input: PostInput): Promise<FeedItem> {
    const response = await api.patch(`/posts/${encodeURIComponent(postId)}`, input);
    return response.data;
  },

  async remove(postId: string): Promise<void> {
    await api.delete(`/posts/${encodeURIComponent(postId)}`);
  },
};
