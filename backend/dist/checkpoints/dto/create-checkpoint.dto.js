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
exports.CreateCheckpointDto = exports.CheckpointType = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
var CheckpointType;
(function (CheckpointType) {
    CheckpointType["VIEWPOINT"] = "viewpoint";
    CheckpointType["WATER_SOURCE"] = "water_source";
    CheckpointType["CAMPSITE"] = "campsite";
    CheckpointType["LANDMARK"] = "landmark";
    CheckpointType["SUMMIT"] = "summit";
    CheckpointType["SHELTER"] = "shelter";
    CheckpointType["BRIDGE"] = "bridge";
    CheckpointType["PASS"] = "pass";
    CheckpointType["LAKE"] = "lake";
    CheckpointType["WATERFALL"] = "waterfall";
    CheckpointType["RUINS"] = "ruins";
    CheckpointType["CHURCH"] = "church";
    CheckpointType["TOWER"] = "tower";
})(CheckpointType || (exports.CheckpointType = CheckpointType = {}));
class CreateCheckpointDto {
    trail_id;
    name_en;
    name_ka;
    description_en;
    description_ka;
    type;
    coordinates;
    elevation_m;
    photo_url;
    sort_order;
    is_checkable;
}
exports.CreateCheckpointDto = CreateCheckpointDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateCheckpointDto.prototype, "trail_id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCheckpointDto.prototype, "name_en", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCheckpointDto.prototype, "name_ka", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCheckpointDto.prototype, "description_en", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCheckpointDto.prototype, "description_ka", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(CheckpointType),
    __metadata("design:type", String)
], CreateCheckpointDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreateCheckpointDto.prototype, "coordinates", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateCheckpointDto.prototype, "elevation_m", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCheckpointDto.prototype, "photo_url", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateCheckpointDto.prototype, "sort_order", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCheckpointDto.prototype, "is_checkable", void 0);
//# sourceMappingURL=create-checkpoint.dto.js.map