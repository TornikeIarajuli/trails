import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { SubmitCompletionDto } from './dto/submit-completion.dto';

@Injectable()
export class CompletionsService {
  // Max distance in meters between proof photo GPS and trail endpoint
  private readonly GPS_PROXIMITY_THRESHOLD_M = 500;

  constructor(private supabaseService: SupabaseService) {}

  async submit(userId: string, dto: SubmitCompletionDto) {
    const admin = this.supabaseService.getAdminClient();

    // Check if already completed
    const { data: existing } = await admin
      .from('trail_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('trail_id', dto.trail_id)
      .single();

    if (existing) {
      throw new ConflictException('You have already submitted a completion for this trail');
    }

    // Get trail endpoint for GPS validation
    const { data: trail } = await admin
      .from('trails')
      .select('id, end_point, name_en')
      .eq('id', dto.trail_id)
      .single();

    if (!trail) {
      throw new NotFoundException('Trail not found');
    }

    // Validate GPS proximity to trail endpoint
    let status: 'pending' | 'approved' = 'pending';

    if (trail.end_point) {
      const distance = await this.calculateDistanceToEndpoint(
        admin,
        dto.trail_id,
        dto.photo_lat,
        dto.photo_lng,
      );

      if (distance !== null && distance <= this.GPS_PROXIMITY_THRESHOLD_M) {
        status = 'approved'; // Auto-approve if within proximity
      }
    }

    const { data, error } = await admin
      .from('trail_completions')
      .insert({
        user_id: userId,
        trail_id: dto.trail_id,
        proof_photo_url: dto.proof_photo_url,
        photo_lat: dto.photo_lat,
        photo_lng: dto.photo_lng,
        status,
        completed_at: dto.completed_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Update user's completed trail count if auto-approved
    if (status === 'approved') {
      await this.incrementUserCompletionCount(admin, userId);
      // Check for new badges
      await admin.rpc('check_and_award_badges', { p_user_id: userId });
    }

    return {
      ...data,
      auto_approved: status === 'approved',
      message:
        status === 'approved'
          ? 'GPS verified! Trail completion approved automatically.'
          : 'Proof submitted. Pending manual review (GPS too far from endpoint).',
    };
  }

  private async calculateDistanceToEndpoint(
    admin: ReturnType<SupabaseService['getAdminClient']>,
    trailId: string,
    lat: number,
    lng: number,
  ): Promise<number | null> {
    const { data, error } = await admin.rpc('distance_to_trail_endpoint', {
      p_trail_id: trailId,
      p_lat: lat,
      p_lng: lng,
    });

    if (error) {
      console.error('GPS distance calculation failed:', error);
      return null;
    }

    return data;
  }

  private async incrementUserCompletionCount(
    admin: ReturnType<SupabaseService['getAdminClient']>,
    userId: string,
  ) {
    await admin.rpc('increment_trail_count', { p_user_id: userId });
  }

  async getUserCompletions(userId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('trail_completions')
      .select(
        `
        *,
        trails:trail_id (id, name_en, name_ka, difficulty, region, cover_image_url)
      `,
      )
      .eq('user_id', userId)
      .order('completed_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getTrailCompletions(trailId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('trail_completions')
      .select(
        `
        *,
        profiles:user_id (id, username, avatar_url)
      `,
      )
      .eq('trail_id', trailId)
      .eq('status', 'approved')
      .order('completed_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async reviewCompletion(
    completionId: string,
    status: 'approved' | 'rejected',
    reviewerNote?: string,
  ) {
    const admin = this.supabaseService.getAdminClient();

    const { data: completion } = await admin
      .from('trail_completions')
      .select('*')
      .eq('id', completionId)
      .single();

    if (!completion) {
      throw new NotFoundException('Completion not found');
    }

    if (completion.status !== 'pending') {
      throw new BadRequestException('Completion already reviewed');
    }

    const { data, error } = await admin
      .from('trail_completions')
      .update({ status, reviewer_note: reviewerNote })
      .eq('id', completionId)
      .select()
      .single();

    if (error) throw error;

    // Update count if approving
    if (status === 'approved') {
      await this.incrementUserCompletionCount(admin, completion.user_id);
      await admin.rpc('check_and_award_badges', { p_user_id: completion.user_id });
    }

    return data;
  }
}
