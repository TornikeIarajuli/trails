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
exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../config/supabase.config");
let ReviewsService = class ReviewsService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async submit(userId, dto) {
        const admin = this.supabaseService.getAdminClient();
        const { data: existing } = await admin
            .from('trail_reviews')
            .select('id')
            .eq('user_id', userId)
            .eq('trail_id', dto.trail_id)
            .single();
        if (existing) {
            throw new common_1.ConflictException('You have already reviewed this trail');
        }
        const { data, error } = await admin
            .from('trail_reviews')
            .insert({
            user_id: userId,
            trail_id: dto.trail_id,
            rating: dto.rating,
            comment: dto.comment,
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
    async getTrailReviews(trailId) {
        const admin = this.supabaseService.getAdminClient();
        const { data, error } = await admin
            .from('trail_reviews')
            .select(`
        *,
        profiles:user_id (id, username, avatar_url)
      `)
            .eq('trail_id', trailId)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data;
    }
    async update(userId, reviewId, rating, comment) {
        const admin = this.supabaseService.getAdminClient();
        const { data: review } = await admin
            .from('trail_reviews')
            .select('id, user_id')
            .eq('id', reviewId)
            .single();
        if (!review)
            throw new common_1.NotFoundException('Review not found');
        if (review.user_id !== userId)
            throw new common_1.ForbiddenException('You can only edit your own review');
        const updateData = { rating };
        if (comment !== undefined)
            updateData.comment = comment;
        const { data, error } = await admin
            .from('trail_reviews')
            .update(updateData)
            .eq('id', reviewId)
            .select(`
        *,
        profiles:user_id (id, username, avatar_url)
      `)
            .single();
        if (error)
            throw error;
        return data;
    }
    async remove(userId, reviewId) {
        const admin = this.supabaseService.getAdminClient();
        const { data: review } = await admin
            .from('trail_reviews')
            .select('id, user_id')
            .eq('id', reviewId)
            .single();
        if (!review)
            throw new common_1.NotFoundException('Review not found');
        if (review.user_id !== userId)
            throw new common_1.ForbiddenException('You can only delete your own review');
        const { error } = await admin
            .from('trail_reviews')
            .delete()
            .eq('id', reviewId);
        if (error)
            throw error;
        return { message: 'Review deleted' };
    }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_config_1.SupabaseService])
], ReviewsService);
//# sourceMappingURL=reviews.service.js.map