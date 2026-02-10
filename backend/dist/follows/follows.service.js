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
exports.FollowsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../config/supabase.config");
const notifications_service_1 = require("../notifications/notifications.service");
let FollowsService = class FollowsService {
    supabaseService;
    notificationsService;
    constructor(supabaseService, notificationsService) {
        this.supabaseService = supabaseService;
        this.notificationsService = notificationsService;
    }
    async toggle(followerId, followingId) {
        if (followerId === followingId) {
            throw new common_1.BadRequestException('You cannot follow yourself');
        }
        const admin = this.supabaseService.getAdminClient();
        const { data: existing } = await admin
            .from('user_follows')
            .select('id')
            .eq('follower_id', followerId)
            .eq('following_id', followingId)
            .single();
        if (existing) {
            await admin
                .from('user_follows')
                .delete()
                .eq('follower_id', followerId)
                .eq('following_id', followingId);
            return { following: false };
        }
        const { error } = await admin
            .from('user_follows')
            .insert({ follower_id: followerId, following_id: followingId });
        if (error)
            throw error;
        const { data: followerProfile } = await admin
            .from('profiles')
            .select('username')
            .eq('id', followerId)
            .single();
        const username = followerProfile?.username ?? 'Someone';
        this.notificationsService
            .sendToUser(followingId, 'New Follower', `${username} started following you`, {
            type: 'new_follower',
            followerId,
        })
            .catch(() => { });
        return { following: true };
    }
    async isFollowing(followerId, followingId) {
        const admin = this.supabaseService.getAdminClient();
        const { data } = await admin
            .from('user_follows')
            .select('id')
            .eq('follower_id', followerId)
            .eq('following_id', followingId)
            .single();
        return { following: !!data };
    }
    async getFollowers(userId, page = 1, limit = 20) {
        const admin = this.supabaseService.getAdminClient();
        const offset = (page - 1) * limit;
        const { data, error, count } = await admin
            .from('user_follows')
            .select(`
        id,
        created_at,
        profiles:follower_id (id, username, full_name, avatar_url)
      `, { count: 'exact' })
            .eq('following_id', userId)
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
    async getFollowing(userId, page = 1, limit = 20) {
        const admin = this.supabaseService.getAdminClient();
        const offset = (page - 1) * limit;
        const { data, error, count } = await admin
            .from('user_follows')
            .select(`
        id,
        created_at,
        profiles:following_id (id, username, full_name, avatar_url)
      `, { count: 'exact' })
            .eq('follower_id', userId)
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
    async getCounts(userId) {
        const admin = this.supabaseService.getAdminClient();
        const { count: followersCount, error: e1 } = await admin
            .from('user_follows')
            .select('id', { count: 'exact', head: true })
            .eq('following_id', userId);
        if (e1)
            throw e1;
        const { count: followingCount, error: e2 } = await admin
            .from('user_follows')
            .select('id', { count: 'exact', head: true })
            .eq('follower_id', userId);
        if (e2)
            throw e2;
        return {
            followers_count: followersCount ?? 0,
            following_count: followingCount ?? 0,
        };
    }
};
exports.FollowsService = FollowsService;
exports.FollowsService = FollowsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_config_1.SupabaseService,
        notifications_service_1.NotificationsService])
], FollowsService);
//# sourceMappingURL=follows.service.js.map