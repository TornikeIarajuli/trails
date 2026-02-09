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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowsController = void 0;
const common_1 = require("@nestjs/common");
const follows_service_1 = require("./follows.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let FollowsController = class FollowsController {
    followsService;
    constructor(followsService) {
        this.followsService = followsService;
    }
    toggle(currentUserId, targetUserId) {
        return this.followsService.toggle(currentUserId, targetUserId);
    }
    isFollowing(currentUserId, targetUserId) {
        return this.followsService.isFollowing(currentUserId, targetUserId);
    }
    getFollowers(userId, page, limit) {
        return this.followsService.getFollowers(userId, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
    }
    getFollowing(userId, page, limit) {
        return this.followsService.getFollowing(userId, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
    }
    getCounts(userId) {
        return this.followsService.getCounts(userId);
    }
};
exports.FollowsController = FollowsController;
__decorate([
    (0, common_1.Post)(':userId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FollowsController.prototype, "toggle", null);
__decorate([
    (0, common_1.Get)('check/:userId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FollowsController.prototype, "isFollowing", null);
__decorate([
    (0, common_1.Get)('followers/:userId'),
    __param(0, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], FollowsController.prototype, "getFollowers", null);
__decorate([
    (0, common_1.Get)('following/:userId'),
    __param(0, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], FollowsController.prototype, "getFollowing", null);
__decorate([
    (0, common_1.Get)('counts/:userId'),
    __param(0, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FollowsController.prototype, "getCounts", null);
exports.FollowsController = FollowsController = __decorate([
    (0, common_1.Controller)('follows'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [follows_service_1.FollowsService])
], FollowsController);
//# sourceMappingURL=follows.controller.js.map