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
exports.AdminGuard = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../../config/supabase.config");
let AdminGuard = class AdminGuard {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('Missing or invalid authorization header');
        }
        const token = authHeader.substring(7);
        const { data: { user }, error, } = await this.supabaseService.getAdminClient().auth.getUser(token);
        if (error || !user) {
            throw new common_1.UnauthorizedException('Invalid or expired token');
        }
        if (user.user_metadata?.role !== 'admin') {
            throw new common_1.ForbiddenException('Admin access required');
        }
        request.user = user;
        request.accessToken = token;
        return true;
    }
};
exports.AdminGuard = AdminGuard;
exports.AdminGuard = AdminGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_config_1.SupabaseService])
], AdminGuard);
//# sourceMappingURL=admin.guard.js.map