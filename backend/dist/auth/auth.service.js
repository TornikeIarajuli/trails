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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../config/supabase.config");
let AuthService = class AuthService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async signup(dto) {
        const admin = this.supabaseService.getAdminClient();
        const { data: existing } = await admin
            .from('profiles')
            .select('id')
            .eq('username', dto.username)
            .single();
        if (existing) {
            throw new common_1.BadRequestException('Username already taken');
        }
        const { data, error } = await admin.auth.signUp({
            email: dto.email,
            password: dto.password,
            options: {
                data: {
                    username: dto.username,
                    full_name: dto.full_name || '',
                },
            },
        });
        if (error) {
            throw new common_1.BadRequestException(error.message);
        }
        return {
            user: data.user,
            session: data.session,
        };
    }
    async login(dto) {
        const client = this.supabaseService.getClient();
        const { data, error } = await client.auth.signInWithPassword({
            email: dto.email,
            password: dto.password,
        });
        if (error) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        return {
            user: data.user,
            session: data.session,
        };
    }
    async refreshToken(refreshToken) {
        const client = this.supabaseService.getClient();
        const { data, error } = await client.auth.refreshSession({
            refresh_token: refreshToken,
        });
        if (error) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        return {
            session: data.session,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_config_1.SupabaseService])
], AuthService);
//# sourceMappingURL=auth.service.js.map