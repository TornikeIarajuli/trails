import api from './api';
import { Review } from '../types/review';

export const reviewsService = {
  async getTrailReviews(trailId: string): Promise<Review[]> {
    const response = await api.get(`/reviews/trail/${trailId}`);
    return response.data;
  },

  async submitReview(data: {
    trail_id: string;
    rating: number;
    comment?: string;
  }): Promise<Review> {
    const response = await api.post('/reviews', data);
    return response.data;
  },

  async updateReview(
    id: string,
    data: { rating: number; comment?: string },
  ): Promise<Review> {
    const response = await api.patch(`/reviews/${id}`, data);
    return response.data;
  },

  async deleteReview(id: string): Promise<void> {
    await api.delete(`/reviews/${id}`);
  },
};
