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
exports.MediaController = void 0;
const common_1 = require("@nestjs/common");
const media_service_1 = require("./media.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let MediaController = class MediaController {
    mediaService;
    constructor(mediaService) {
        this.mediaService = mediaService;
    }
    async uploadTrailMedia(trailId, req) {
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const fileBuffer = Buffer.concat(chunks);
        const fileName = req.headers['x-file-name'] || 'upload.jpg';
        const mimeType = req.headers['content-type'] || 'image/jpeg';
        const mediaType = (req.headers['x-media-type'] || 'photo');
        const caption = req.headers['x-caption'];
        if (!fileBuffer.length) {
            throw new common_1.BadRequestException('No file provided');
        }
        return this.mediaService.uploadTrailMedia(trailId, fileBuffer, fileName, mimeType, mediaType, caption);
    }
    async uploadProofPhoto(req) {
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const fileBuffer = Buffer.concat(chunks);
        const fileName = req.headers['x-file-name'] || 'proof.jpg';
        const mimeType = req.headers['content-type'] || 'image/jpeg';
        if (!fileBuffer.length) {
            throw new common_1.BadRequestException('No file provided');
        }
        return this.mediaService.uploadProofPhoto(fileBuffer, fileName, mimeType);
    }
    async uploadAvatar(userId, req) {
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const fileBuffer = Buffer.concat(chunks);
        const fileName = req.headers['x-file-name'] || 'avatar.jpg';
        const mimeType = req.headers['content-type'] || 'image/jpeg';
        if (!fileBuffer.length) {
            throw new common_1.BadRequestException('No file provided');
        }
        return this.mediaService.uploadAvatar(userId, fileBuffer, fileName, mimeType);
    }
    deleteMedia(id) {
        return this.mediaService.deleteMedia(id);
    }
};
exports.MediaController = MediaController;
__decorate([
    (0, common_1.Post)('trail/:trailId'),
    __param(0, (0, common_1.Param)('trailId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "uploadTrailMedia", null);
__decorate([
    (0, common_1.Post)('proof'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "uploadProofPhoto", null);
__decorate([
    (0, common_1.Post)('avatar'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "uploadAvatar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MediaController.prototype, "deleteMedia", null);
exports.MediaController = MediaController = __decorate([
    (0, common_1.Controller)('media'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [media_service_1.MediaService])
], MediaController);
//# sourceMappingURL=media.controller.js.map