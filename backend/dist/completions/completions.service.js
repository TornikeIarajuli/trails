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
exports.CompletionsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../config/supabase.config");
const notifications_service_1 = require("../notifications/notifications.service");
let CompletionsService = class CompletionsService {
    supabaseService;
    notificationsService;
    GPS_PROXIMITY_THRESHOLD_M = 500;
    constructor(supabaseService, notificationsService) {
        this.supabaseService = supabaseService;
        this.notificationsService = notificationsService;
    }
    async submit(userId, dto) {
        const admin = this.supabaseService.getAdminClient();
        const { data: existing } = await admin
            .from('trail_completions')
            .select('id')
            .eq('user_id', userId)
            .eq('trail_id', dto.trail_id)
            .single();
        if (existing) {
            throw new common_1.ConflictException('You have already submitted a completion for this trail');
        }
        const { data: trail } = await admin
            .from('trails')
            .select('id, end_point, name_en')
            .eq('id', dto.trail_id)
            .single();
        if (!trail) {
            throw new common_1.NotFoundException('Trail not found');
        }
        let status = 'pending';
        if (trail.end_point) {
            const distance = await this.calculateDistanceToEndpoint(admin, dto.trail_id, dto.photo_lat, dto.photo_lng);
            if (distance !== null && distance <= this.GPS_PROXIMITY_THRESHOLD_M) {
                status = 'approved';
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
        if (error)
            throw error;
        if (status === 'approved') {
            await this.incrementUserCompletionCount(admin, userId);
            await admin.rpc('check_and_award_badges', { p_user_id: userId });
        }
        return {
            ...data,
            auto_approved: status === 'approved',
            message: status === 'approved'
                ? 'GPS verified! Trail completion approved automatically.'
                : 'Proof submitted. Pending manual review (GPS too far from endpoint).',
        };
    }
    async calculateDistanceToEndpoint(admin, trailId, lat, lng) {
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
    async incrementUserCompletionCount(admin, userId) {
        await admin.rpc('increment_trail_count', { p_user_id: userId });
    }
    async recordHike(userId, trailId, elapsedSeconds) {
        const admin = this.supabaseService.getAdminClient();
        const { data: existing } = await admin
            .from('trail_completions')
            .select('id')
            .eq('user_id', userId)
            .eq('trail_id', trailId)
            .single();
        if (existing) {
            return { id: existing.id, already_existed: true };
        }
        const { data: trail } = await admin
            .from('trails')
            .select('id')
            .eq('id', trailId)
            .single();
        if (!trail) {
            throw new common_1.NotFoundException('Trail not found');
        }
        const { data, error } = await admin
            .from('trail_completions')
            .insert({
            user_id: userId,
            trail_id: trailId,
            status: 'approved',
            completed_at: new Date().toISOString(),
            elapsed_seconds: elapsedSeconds ?? null,
        })
            .select()
            .single();
        if (error)
            throw error;
        await this.incrementUserCompletionCount(admin, userId);
        const badgeResult = await admin.rpc('check_and_award_badges', { p_user_id: userId });
        if (badgeResult.data && badgeResult.data.length > 0) {
            const { data: newBadges } = await admin
                .from('badges')
                .select('name_en')
                .in('id', badgeResult.data);
            const names = newBadges?.map((b) => b.name_en).join(', ') ?? 'a new badge';
            this.notificationsService
                .sendToUser(userId, 'Badge Earned!', `You earned: ${names}`, {
                type: 'badge_earned',
                badgeIds: badgeResult.data,
            })
                .catch(() => { });
        }
        return data;
    }
    async deleteCompletion(userId, completionId) {
        const admin = this.supabaseService.getAdminClient();
        const { data: completion } = await admin
            .from('trail_completions')
            .select('id, user_id, status')
            .eq('id', completionId)
            .single();
        if (!completion) {
            throw new common_1.NotFoundException('Completion not found');
        }
        if (completion.user_id !== userId) {
            throw new common_1.BadRequestException('You can only delete your own completions');
        }
        const { error } = await admin
            .from('trail_completions')
            .delete()
            .eq('id', completionId);
        if (error)
            throw error;
        if (completion.status === 'approved') {
            await admin.rpc('decrement_trail_count', { p_user_id: userId });
        }
        return { deleted: true };
    }
    async getUserCompletions(userId) {
        const admin = this.supabaseService.getAdminClient();
        const { data, error } = await admin
            .from('trail_completions')
            .select(`
        *,
        trails:trail_id (id, name_en, name_ka, difficulty, region, cover_image_url, distance_km, elevation_gain_m, estimated_hours)
      `)
            .eq('user_id', userId)
            .order('completed_at', { ascending: false });
        if (error)
            throw error;
        return data;
    }
    async getTrailCompletions(trailId) {
        const admin = this.supabaseService.getAdminClient();
        const { data, error } = await admin
            .from('trail_completions')
            .select(`
        *,
        profiles:user_id (id, username, avatar_url)
      `)
            .eq('trail_id', trailId)
            .eq('status', 'approved')
            .order('completed_at', { ascending: false });
        if (error)
            throw error;
        return data;
    }
    async reviewCompletion(completionId, status, reviewerNote) {
        const admin = this.supabaseService.getAdminClient();
        const { data: completion } = await admin
            .from('trail_completions')
            .select('*')
            .eq('id', completionId)
            .single();
        if (!completion) {
            throw new common_1.NotFoundException('Completion not found');
        }
        if (completion.status !== 'pending') {
            throw new common_1.BadRequestException('Completion already reviewed');
        }
        const { data, error } = await admin
            .from('trail_completions')
            .update({ status, reviewer_note: reviewerNote })
            .eq('id', completionId)
            .select()
            .single();
        if (error)
            throw error;
        if (status === 'approved') {
            await this.incrementUserCompletionCount(admin, completion.user_id);
            await admin.rpc('check_and_award_badges', { p_user_id: completion.user_id });
        }
        return data;
    }
};
exports.CompletionsService = CompletionsService;
exports.CompletionsService = CompletionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_config_1.SupabaseService,
        notifications_service_1.NotificationsService])
], CompletionsService);
//# sourceMappingURL=completions.service.js.map