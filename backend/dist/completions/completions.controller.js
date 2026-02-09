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
exports.CompletionsController = void 0;
const common_1 = require("@nestjs/common");
const completions_service_1 = require("./completions.service");
const submit_completion_dto_1 = require("./dto/submit-completion.dto");
const auth_guard_1 = require("../common/guards/auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let CompletionsController = class CompletionsController {
    completionsService;
    constructor(completionsService) {
        this.completionsService = completionsService;
    }
    submit(userId, dto) {
        return this.completionsService.submit(userId, dto);
    }
    getMyCompletions(userId) {
        return this.completionsService.getUserCompletions(userId);
    }
    getTrailCompletions(trailId) {
        return this.completionsService.getTrailCompletions(trailId);
    }
    reviewCompletion(id, status, reviewerNote) {
        return this.completionsService.reviewCompletion(id, status, reviewerNote);
    }
};
exports.CompletionsController = CompletionsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, submit_completion_dto_1.SubmitCompletionDto]),
    __metadata("design:returntype", void 0)
], CompletionsController.prototype, "submit", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompletionsController.prototype, "getMyCompletions", null);
__decorate([
    (0, common_1.Get)('trail/:trailId'),
    __param(0, (0, common_1.Param)('trailId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompletionsController.prototype, "getTrailCompletions", null);
__decorate([
    (0, common_1.Patch)(':id/review'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)('status')),
    __param(2, (0, common_1.Body)('reviewer_note')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], CompletionsController.prototype, "reviewCompletion", null);
exports.CompletionsController = CompletionsController = __decorate([
    (0, common_1.Controller)('completions'),
    __metadata("design:paramtypes", [completions_service_1.CompletionsService])
], CompletionsController);
//# sourceMappingURL=completions.controller.js.map