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
exports.BookmarksService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../config/supabase.config");
let BookmarksService = class BookmarksService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async toggle(userId, trailId) {
        const admin = this.supabaseService.getAdminClient();
        const { data: existing } = await admin
            .from('trail_bookmarks')
            .select('id')
            .eq('user_id', userId)
            .eq('trail_id', trailId)
            .single();
        if (existing) {
            await admin
                .from('trail_bookmarks')
                .delete()
                .eq('user_id', userId)
                .eq('trail_id', trailId);
            return { bookmarked: false };
        }
        const { error } = await admin
            .from('trail_bookmarks')
            .insert({ user_id: userId, trail_id: trailId });
        if (error)
            throw error;
        return { bookmarked: true };
    }
    async getMyBookmarks(userId, page = 1, limit = 20) {
        const admin = this.supabaseService.getAdminClient();
        const offset = (page - 1) * limit;
        const { data, error, count } = await admin
            .from('trail_bookmarks')
            .select(`
        id,
        created_at,
        trails:trail_id (id, name_en, name_ka, difficulty, region, distance_km, elevation_gain_m, estimated_hours, cover_image_url)
      `, { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
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
    async isBookmarked(userId, trailId) {
        const admin = this.supabaseService.getAdminClient();
        const { data } = await admin
            .from('trail_bookmarks')
            .select('id')
            .eq('user_id', userId)
            .eq('trail_id', trailId)
            .single();
        return { bookmarked: !!data };
    }
};
exports.BookmarksService = BookmarksService;
exports.BookmarksService = BookmarksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_config_1.SupabaseService])
], BookmarksService);
//# sourceMappingURL=bookmarks.service.js.map