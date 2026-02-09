"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckpointsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../config/supabase.config");
let CheckpointsService = class CheckpointsService {
    supabaseService;
    GPS_PROXIMITY_THRESHOLD_M = 200;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async create(dto) {
        const admin = this.supabaseService.getAdminClient();
        const { data: trail } = await admin
            .from('trails')
            .select('id')
            .eq('id', dto.trail_id)
            .single();
        if (!trail) {
            throw new common_1.NotFoundException('Trail not found');
        }
        const checkpointData = {
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
        if (error)
            throw error;
        return data;
    }
    async findByTrail(trailId) {
        const admin = this.supabaseService.getAdminClient();
        const { data, error } = await admin
            .from('trail_checkpoints')
            .select('*')
            .eq('trail_id', trailId)
            .order('sort_order', { ascending: true });
        if (error)
            throw error;
        return data;
    }
    async findOne(id) {
        const admin = this.supabaseService.getAdminClient();
        const { data, error } = await admin
            .from('trail_checkpoints')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !data) {
            throw new common_1.NotFoundException('Checkpoint not found');
        }
        return data;
    }
    async update(id, dto) {
        const admin = this.supabaseService.getAdminClient();
        const updateData = { ...dto };
        if (dto.coordinates) {
            updateData.coordinates = `SRID=4326;POINT(${dto.coordinates[0]} ${dto.coordinates[1]})`;
        }
        const { data, error } = await admin
            .from('trail_checkpoints')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        if (!data)
            throw new common_1.NotFoundException('Checkpoint not found');
        return data;
    }
    async remove(id) {
        const admin = this.supabaseService.getAdminClient();
        const { error } = await admin
            .from('trail_checkpoints')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
        return { message: 'Checkpoint deleted successfully' };
    }
    async submitCompletion(userId, dto) {
        const admin = this.supabaseService.getAdminClient();
        const { data: existing } = await admin
            .from('checkpoint_completions')
            .select('id')
            .eq('user_id', userId)
            .eq('checkpoint_id', dto.checkpoint_id)
            .single();
        if (existing) {
            throw new common_1.ConflictException('You have already checked in at this checkpoint');
        }
        const { data: checkpoint } = await admin
            .from('trail_checkpoints')
            .select('id, name_en, is_checkable')
            .eq('id', dto.checkpoint_id)
            .single();
        if (!checkpoint) {
            throw new common_1.NotFoundException('Checkpoint not found');
        }
        if (!checkpoint.is_checkable) {
            throw new common_1.BadRequestException('This checkpoint does not accept check-ins');
        }
        const distance = await this.calculateDistanceToCheckpoint(admin, dto.checkpoint_id, dto.photo_lat, dto.photo_lng);
        if (distance === null || distance > this.GPS_PROXIMITY_THRESHOLD_M) {
            throw new common_1.BadRequestException(`You are too far from the checkpoint (${distance ? Math.round(distance) + 'm' : 'unknown distance'}). Must be within ${this.GPS_PROXIMITY_THRESHOLD_M}m.`);
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
        if (error)
            throw error;
        return {
            ...data,
            message: `Checked in at ${checkpoint.name_en}!`,
        };
    }
    async calculateDistanceToCheckpoint(admin, checkpointId, lat, lng) {
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
    async getUserCheckpointCompletions(userId, trailId) {
        const admin = this.supabaseService.getAdminClient();
        let query = admin
            .from('checkpoint_completions')
            .select(`
        *,
        trail_checkpoints:checkpoint_id (id, name_en, name_ka, type, trail_id, photo_url)
      `)
            .eq('user_id', userId)
            .order('completed_at', { ascending: false });
        if (trailId) {
            query = query.eq('trail_checkpoints.trail_id', trailId);
        }
        const { data, error } = await query;
        if (error)
            throw error;
        if (trailId) {
            return data?.filter((d) => d.trail_checkpoints !== null) ?? [];
        }
        return data;
    }
};
exports.CheckpointsService = CheckpointsService;
exports.CheckpointsService = CheckpointsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_config_1.SupabaseService])
], CheckpointsService);
//# sourceMappingURL=checkpoints.service.js.map