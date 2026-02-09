import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.config';
import { CreateCheckpointDto } from './dto/create-checkpoint.dto';
import { UpdateCheckpointDto } from './dto/update-checkpoint.dto';
import { SubmitCheckpointCompletionDto } from './dto/submit-checkpoint-completion.dto';

@Injectable()
export class CheckpointsService {
  private readonly GPS_PROXIMITY_THRESHOLD_M = 200;

  constructor(private supabaseService: SupabaseService) {}

  async create(dto: CreateCheckpointDto) {
    const admin = this.supabaseService.getAdminClient();

    // Verify trail exists
    const { data: trail } = await admin
      .from('trails')
      .select('id')
      .eq('id', dto.trail_id)
      .single();

    if (!trail) {
      throw new NotFoundException('Trail not found');
    }

    const checkpointData: Record<string, unknown> = {
      trail_id: dto.trail_id,
      name_en: dto.name_en,
      name_ka: dto.name_ka,
      description_en: dto.description_en,
      description_ka: dto.description_ka,
      type: dto.type,
      elevation_m: dto.elevation_m,
      photo_url: dto.photo_url,
      sort_order: dto.sort_order ?? 0,
      is_checkable: dto.is_checkable ?? false,
    };

    if (dto.coordinates) {
      checkpointData.coordinates = `SRID=4326;POINT(${dto.coordinates[0]} ${dto.coordinates[1]})`;
    }

    const { data, error } = await admin
      .from('trail_checkpoints')
      .insert(checkpointData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findByTrail(trailId: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('trail_checkpoints')
      .select('*')
      .eq('trail_id', trailId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data;
  }

  async findOne(id: string) {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('trail_checkpoints')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Checkpoint not found');
    }

    return data;
  }

  async update(id: string, dto: UpdateCheckpointDto) {
    const admin = this.supabaseService.getAdminClient();

    const updateData: Record<string, unknown> = { ...dto };

    // Handle coordinates -> WKT conversion
    if (dto.coordinates) {
      updateData.coordinates = `SRID=4326;POINT(${dto.coordinates[0]} ${dto.coordinates[1]})`;
    }

    const { data, error } = await admin
      .from('trail_checkpoints')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Checkpoint not found');

    return data;
  }

  async remove(id: string) {
    const admin = this.supabaseService.getAdminClient();

    const { error } = await admin
      .from('trail_checkpoints')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { message: 'Checkpoint deleted successfully' };
  }

  async submitCompletion(userId: string, dto: SubmitCheckpointCompletionDto) {
    const admin = this.supabaseService.getAdminClient();

    // Check if already completed
    const { data: existing } = await admin
      .from('checkpoint_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('checkpoint_id', dto.checkpoint_id)
      .single();

    if (existing) {
      throw new ConflictException(
        'You have already checked in at this checkpoint',
      );
    }

    // Verify checkpoint exists and is checkable
    const { data: checkpoint } = await admin
      .from('trail_checkpoints')
      .select('id, name_en, is_checkable')
      .eq('id', dto.checkpoint_id)
      .single();

    if (!checkpoint) {
      throw new NotFoundException('Checkpoint not found');
    }

    if (!checkpoint.is_checkable) {
      throw new BadRequestException(
        'This checkpoint does not accept check-ins',
      );
    }

    // Validate GPS proximity
    const distance = await this.calculateDistanceToCheckpoint(
      admin,
      dto.checkpoint_id,
      dto.photo_lat,
      dto.photo_lng,
    );

    if (distance === null || distance > this.GPS_PROXIMITY_THRESHOLD_M) {
      throw new BadRequestException(
        `You are too far from the checkpoint (${distance ? Math.round(distance) + 'm' : 'unknown distance'}). Must be within ${this.GPS_PROXIMITY_THRESHOLD_M}m.`,
      );
    }

    const { data, error } = await admin
      .from('checkpoint_completions')
      .insert({
        user_id: userId,
        checkpoint_id: dto.checkpoint_id,
        proof_photo_url: dto.proof_photo_url,
        photo_lat: dto.photo_lat,
        photo_lng: dto.photo_lng,
        completed_at: dto.completed_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      ...data,
      message: `Checked in at ${checkpoint.name_en}!`,
    };
  }

  private async calculateDistanceToCheckpoint(
    admin: ReturnType<SupabaseService['getAdminClient']>,
    checkpointId: string,
    lat: number,
    lng: number,
  ): Promise<number | null> {
    const { data, error } = await admin.rpc('distance_to_checkpoint', {
      p_checkpoint_id: checkpointId,
      p_lat: lat,
      p_lng: lng,
    });

    if (error) {
      console.error('Checkpoint distance calculation failed:', error);
      return null;
    }

    return data;
  }

  async getUserCheckpointCompletions(userId: string, trailId?: string) {
    const admin = this.supabaseService.getAdminClient();

    let query = admin
      .from('checkpoint_completions')
      .select(
        `
        *,
        trail_checkpoints:checkpoint_id (id, name_en, name_ka, type, trail_id, photo_url)
      `,
      )
      .eq('user_id', userId)
      .order('completed_at', { ascending: false });

    if (trailId) {
      query = query.eq('trail_checkpoints.trail_id', trailId);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (trailId) {
      return data?.filter((d: any) => d.trail_checkpoints !== null) ?? [];
    }

    return data;
  }
}
