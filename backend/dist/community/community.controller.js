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
exports.CommunityController = void 0;
const common_1 = require("@nestjs/common");
const community_service_1 = require("./community.service");
const report_condition_dto_1 = require("./dto/report-condition.dto");
const upload_photo_dto_1 = require("./dto/upload-photo.dto");
const auth_guard_1 = require("../common/guards/auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let CommunityController = class CommunityController {
    communityService;
    constructor(communityService) {
        this.communityService = communityService;
    }
    reportCondition(userId, dto) {
        return this.communityService.reportCondition(userId, dto);
    }
    getTrailConditions(trailId) {
        return this.communityService.getTrailConditions(trailId);
    }
    deactivateCondition(userId, id) {
        return this.communityService.deactivateCondition(userId, id);
    }
    uploadPhoto(userId, dto) {
        return this.communityService.uploadPhoto(userId, dto);
    }
    getTrailPhotos(trailId, page, limit) {
        return this.communityService.getTrailPhotos(trailId, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
    }
    toggleLike(userId, id) {
        return this.communityService.toggleLike(userId, id);
    }
    deletePhoto(userId, id) {
        return this.communityService.deletePhoto(userId, id);
    }
};
exports.CommunityController = CommunityController;
__decorate([
    (0, common_1.Post)('conditions'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, report_condition_dto_1.ReportConditionDto]),
    __metadata("design:returntype", void 0)
], CommunityController.prototype, "reportCondition", null);
__decorate([
    (0, common_1.Get)('conditions/:trailId'),
    __param(0, (0, common_1.Param)('trailId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CommunityController.prototype, "getTrailConditions", null);
__decorate([
    (0, common_1.Delete)('conditions/:id'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CommunityController.prototype, "deactivateCondition", null);
__decorate([
    (0, common_1.Post)('photos'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, upload_photo_dto_1.UploadPhotoDto]),
    __metadata("design:returntype", void 0)
], CommunityController.prototype, "uploadPhoto", null);
__decorate([
    (0, common_1.Get)('photos/:trailId'),
    __param(0, (0, common_1.Param)('trailId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], CommunityController.prototype, "getTrailPhotos", null);
__decorate([
    (0, common_1.Post)('photos/:id/like'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CommunityController.prototype, "toggleLike", null);
__decorate([
    (0, common_1.Delete)('photos/:id'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CommunityController.prototype, "deletePhoto", null);
exports.CommunityController = CommunityController = __decorate([
    (0, common_1.Controller)('community'),
    __metadata("design:paramtypes", [community_service_1.CommunityService])
], CommunityController);
//# sourceMappingURL=community.controller.js.map