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
exports.TrailsController = void 0;
const common_1 = require("@nestjs/common");
const trails_service_1 = require("./trails.service");
const create_trail_dto_1 = require("./dto/create-trail.dto");
const update_trail_details_dto_1 = require("./dto/update-trail-details.dto");
const trail_filter_dto_1 = require("./dto/trail-filter.dto");
const admin_guard_1 = require("../common/guards/admin.guard");
let TrailsController = class TrailsController {
    trailsService;
    constructor(trailsService) {
        this.trailsService = trailsService;
    }
    findAll(filter) {
        return this.trailsService.findAll(filter);
    }
    getRegions() {
        return this.trailsService.getRegions();
    }
    findNearby(query) {
        return this.trailsService.findNearby(query);
    }
    findOne(id) {
        return this.trailsService.findOne(id);
    }
    create(dto) {
        return this.trailsService.create(dto);
    }
    update(id, dto) {
        return this.trailsService.updateDetails(id, dto);
    }
    remove(id) {
        return this.trailsService.remove(id);
    }
};
exports.TrailsController = TrailsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [trail_filter_dto_1.TrailFilterDto]),
    __metadata("design:returntype", void 0)
], TrailsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('regions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TrailsController.prototype, "getRegions", null);
__decorate([
    (0, common_1.Get)('nearby'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [trail_filter_dto_1.NearbyQueryDto]),
    __metadata("design:returntype", void 0)
], TrailsController.prototype, "findNearby", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TrailsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_trail_dto_1.CreateTrailDto]),
    __metadata("design:returntype", void 0)
], TrailsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_trail_details_dto_1.UpdateTrailDetailsDto]),
    __metadata("design:returntype", void 0)
], TrailsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TrailsController.prototype, "remove", null);
exports.TrailsController = TrailsController = __decorate([
    (0, common_1.Controller)('trails'),
    __metadata("design:paramtypes", [trails_service_1.TrailsService])
], TrailsController);
//# sourceMappingURL=trails.controller.js.map