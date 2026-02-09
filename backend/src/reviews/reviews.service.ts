import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { SubmitReviewDto } from './dto/submit-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private supabaseService: SupabaseService) {}

  async submit(userId: string, dto: SubmitReviewDto) {
    const admin = this.supabaseService.getAdminClient();

    // Check if already reviewed
    const { data: existing } = await admin
      .from('trail_reviews')
      .select('id')
      .eq('user_id', userId)
      .eq('trail_id', dto.trail_id)
      .single();

    if (existing) {
      throw new ConflictException('You have already reviewed this trail');
    }

    const { data, error } = await admin
      .from('trail_reviews')
      .insert({
        user_id: userId,
        trail_id: dto.trail_id,
        rating: dto.rating,
        comment: dto.comment,
      })
      .select(
        `
        *,
        profiles:user_id (id, username, avatar_url)
      `,
      )
      .single();

    if (error) throw error;
    return data;
  }

  async getTrailReviews(trailId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('trail_reviews')
      .select(
        `
        *,
        profiles:user_id (id, username, avatar_url)
      `,
      )
      .eq('trail_id', trailId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async update(userId: string, reviewId: string, rating: number, comment?: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: review } = await admin
      .from('trail_reviews')
      .select('id, user_id')
      .eq('id', reviewId)
      .single();

    if (!review) throw new NotFoundException('Review not found');
    if (review.user_id !== userId)
      throw new ForbiddenException('You can only edit your own review');

    const updateData: Record<string, unknown> = { rating };
    if (comment !== undefined) updateData.comment = comment;

    const { data, error } = await admin
      .from('trail_reviews')
      .update(updateData)
      .eq('id', reviewId)
      .select(
        `
        *,
        profiles:user_id (id, username, avatar_url)
      `,
      )
      .single();

    if (error) throw error;
    return data;
  }

  async remove(userId: string, reviewId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data: review } = await admin
      .from('trail_reviews')
      .select('id, user_id')
      .eq('id', reviewId)
      .single();

    if (!review) throw new NotFoundException('Review not found');
    if (review.user_id !== userId)
      throw new ForbiddenException('You can only delete your own review');

    const { error } = await admin
      .from('trail_reviews')
      .delete()
      .eq('id', reviewId);

    if (error) throw error;
    return { message: 'Review deleted' };
  }
}
