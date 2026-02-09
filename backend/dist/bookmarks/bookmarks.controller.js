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
exports.BookmarksController = void 0;
const common_1 = require("@nestjs/common");
const bookmarks_service_1 = require("./bookmarks.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let BookmarksController = class BookmarksController {
    bookmarksService;
    constructor(bookmarksService) {
        this.bookmarksService = bookmarksService;
    }
    toggle(userId, trailId) {
        return this.bookmarksService.toggle(userId, trailId);
    }
    getMyBookmarks(userId, page, limit) {
        return this.bookmarksService.getMyBookmarks(userId, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
    }
    isBookmarked(userId, trailId) {
        return this.bookmarksService.isBookmarked(userId, trailId);
    }
};
exports.BookmarksController = BookmarksController;
__decorate([
    (0, common_1.Post)(':trailId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('trailId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], BookmarksController.prototype, "toggle", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], BookmarksController.prototype, "getMyBookmarks", null);
__decorate([
    (0, common_1.Get)('check/:trailId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('trailId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], BookmarksController.prototype, "isBookmarked", null);
exports.BookmarksController = BookmarksController = __decorate([
    (0, common_1.Controller)('bookmarks'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [bookmarks_service_1.BookmarksService])
], BookmarksController);
//# sourceMappingURL=bookmarks.controller.js.map