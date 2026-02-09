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
exports.CommunityService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../config/supabase.config");
let CommunityService = class CommunityService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async reportCondition(userId, dto) {
        const admin = this.supabaseService.getAdminClient();
        const { data, error } = await admin
            .from('trail_conditions')
            .insert({
            trail_id: dto.trail_id,
            user_id: userId,
            condition_type: dto.condition_type,
            severity: dto.severity,
            description: dto.description,
            photo_url: dto.photo_url,
        })
            .select(`
        *,
        profiles:user_id (id, username, avatar_url)
      `)
            .single();
        if (error)
            throw error;
        return data;
    }
    async getTrailConditions(trailId) {
        const admin = this.supabaseService.getAdminClient();
        const { data, error } = await admin
            .from('trail_conditions')
            .select(`
        *,
        profiles:user_id (id, username, avatar_url)
      `)
            .eq('trail_id', trailId)
            .eq('is_active', true)
            .order('reported_at', { ascending: false });
        if (error)
            throw error;
        return data;
    }
    async deactivateCondition(userId, conditionId) {
        const admin = this.supabaseService.getAdminClient();
        const { data: condition } = await admin
            .from('trail_conditions')
            .select('id, user_id')
            .eq('id', conditionId)
            .single();
        if (!condition)
            throw new common_1.NotFoundException('Condition not found');
        if (condition.user_id !== userId)
            throw new common_1.ForbiddenException('You can only deactivate your own reports');
        const { error } = await admin
            .from('trail_conditions')
            .update({ is_active: false })
            .eq('id', conditionId);
        if (error)
            throw error;
        return { message: 'Condition report deactivated' };
    }
    async uploadPhoto(userId, dto) {
        const admin = this.supabaseService.getAdminClient();
        const { data, error } = await admin
            .from('trail_photos')
            .insert({
            trail_id: dto.trail_id,
            user_id: userId,
            url: dto.url,
            caption: dto.caption,
        })
            .select(`
        *,
        profiles:user_id (id, username, avatar_url)
      `)
            .single();
        if (error)
            throw error;
        return data;
    }
    async getTrailPhotos(trailId, page = 1, limit = 20) {
        const admin = this.supabaseService.getAdminClient();
        const offset = (page - 1) * limit;
        const { data, error, count } = await admin
            .from('trail_photos')
            .select(`
        *,
        profiles:user_id (id, username, avatar_url)
      `, { count: 'exact' })
            .eq('trail_id', trailId)
            .order('taken_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error)
            throw error;
        return {
            data: data ?? [],
            pagination: {
                page,
                limit,
                total: count ?? 0,
                totalPages: Math.ceil((count ?? 0) / limit),
            },
        };
    }
    async toggleLike(userId, photoId) {
        const admin = this.supabaseService.getAdminClient();
        const { data, error } = await admin.rpc('toggle_photo_like', {
            p_photo_id: photoId,
            p_user_id: userId,
        });
        if (error)
            throw error;
        return data;
    }
    async deletePhoto(userId, photoId) {
        const admin = this.supabaseService.getAdminClient();
        const { data: photo } = await admin
            .from('trail_photos')
            .select('id, user_id')
            .eq('id', photoId)
            .single();
        if (!photo)
            throw new common_1.NotFoundException('Photo not found');
        if (photo.user_id !== userId)
            throw new common_1.ForbiddenException('You can only delete your own photos');
        const { error } = await admin
            .from('trail_photos')
            .delete()
            .eq('id', photoId);
        if (error)
            throw error;
        return { message: 'Photo deleted' };
    }
};
exports.CommunityService = CommunityService;
exports.CommunityService = CommunityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_config_1.SupabaseService])
], CommunityService);
//# sourceMappingURL=community.service.js.map