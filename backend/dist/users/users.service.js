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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../config/supabase.config");
let UsersService = class UsersService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async getProfile(userId) {
        const admin = this.supabaseService.getAdminClient();
        const { data: profile, error } = await admin
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error || !profile) {
            throw new common_1.NotFoundException('User not found');
        }
        const { data: completions } = await admin
            .from('trail_completions')
            .select(`
        trail_id,
        status,
        trails:trail_id (difficulty)
      `)
            .eq('user_id', userId)
            .eq('status', 'approved');
        const stats = {
            easy: 0,
            medium: 0,
            hard: 0,
            ultra: 0,
            total: completions?.length ?? 0,
        };
        completions?.forEach((c) => {
            const trail = c.trails;
            if (trail?.difficulty && trail.difficulty in stats) {
                stats[trail.difficulty]++;
            }
        });
        return {
            ...profile,
            stats,
        };
    }
    async updateProfile(userId, data) {
        const admin = this.supabaseService.getAdminClient();
        const { data: profile, error } = await admin
            .from('profiles')
            .update(data)
            .eq('id', userId)
            .select()
            .single();
        if (error)
            throw error;
        if (!profile)
            throw new common_1.NotFoundException('User not found');
        return profile;
    }
    async getLeaderboard(limit = 20) {
        const admin = this.supabaseService.getAdminClient();
        const { data, error } = await admin
            .from('profiles')
            .select('id, username, full_name, avatar_url, total_trails_completed')
            .gt('total_trails_completed', 0)
            .order('total_trails_completed', { ascending: false })
            .limit(limit);
        if (error)
            throw error;
        return data?.map((user, index) => ({
            rank: index + 1,
            ...user,
        }));
    }
    async searchUsers(query) {
        const admin = this.supabaseService.getAdminClient();
        const { data, error } = await admin
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
            .limit(20);
        if (error)
            throw error;
        return data ?? [];
    }
    async getPublicProfile(userId) {
        const admin = this.supabaseService.getAdminClient();
        const { data: profile, error } = await admin
            .from('profiles')
            .select('id, username, full_name, avatar_url, bio, total_trails_completed, created_at')
            .eq('id', userId)
            .single();
        if (error || !profile) {
            throw new common_1.NotFoundException('User not found');
        }
        const { data: completions } = await admin
            .from('trail_completions')
            .select(`
        id,
        completed_at,
        proof_photo_url,
        trails:trail_id (id, name_en, difficulty, region, cover_image_url, distance_km, elevation_gain_m)
      `)
            .eq('user_id', userId)
            .eq('status', 'approved')
            .order('completed_at', { ascending: false });
        const stats = {
            easy: 0,
            medium: 0,
            hard: 0,
            ultra: 0,
            total: completions?.length ?? 0,
        };
        completions?.forEach((c) => {
            const trail = c.trails;
            if (trail?.difficulty && trail.difficulty in stats) {
                stats[trail.difficulty]++;
            }
        });
        return {
            ...profile,
            stats,
            completions: completions ?? [],
        };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_config_1.SupabaseService])
], UsersService);
//# sourceMappingURL=users.service.js.map