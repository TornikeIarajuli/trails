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
exports.BadgesService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../config/supabase.config");
let BadgesService = class BadgesService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async getAllBadges() {
        const admin = this.supabaseService.getAdminClient();
        const { data, error } = await admin
            .from('badges')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error)
            throw error;
        return data;
    }
    async getUserBadges(userId) {
        const admin = this.supabaseService.getAdminClient();
        const { data, error } = await admin
            .from('user_badges')
            .select(`
        id,
        earned_at,
        badges:badge_id (*)
      `)
            .eq('user_id', userId)
            .order('earned_at', { ascending: false });
        if (error)
            throw error;
        return data;
    }
    async checkAndAward(userId) {
        const admin = this.supabaseService.getAdminClient();
        const { data, error } = await admin.rpc('check_and_award_badges', {
            p_user_id: userId,
        });
        if (error)
            throw error;
        if (data && data.length > 0) {
            const { data: newBadges } = await admin
                .from('badges')
                .select('*')
                .in('id', data);
            return { new_badges: newBadges ?? [], count: data.length };
        }
        return { new_badges: [], count: 0 };
    }
};
exports.BadgesService = BadgesService;
exports.BadgesService = BadgesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_config_1.SupabaseService])
], BadgesService);
//# sourceMappingURL=badges.service.js.map