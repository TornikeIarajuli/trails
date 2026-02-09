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
exports.CreateTrailDto = exports.TrailDifficulty = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
var TrailDifficulty;
(function (TrailDifficulty) {
    TrailDifficulty["EASY"] = "easy";
    TrailDifficulty["MEDIUM"] = "medium";
    TrailDifficulty["HARD"] = "hard";
    TrailDifficulty["ULTRA"] = "ultra";
})(TrailDifficulty || (exports.TrailDifficulty = TrailDifficulty = {}));
class CreateTrailDto {
    name_en;
    name_ka;
    description_en;
    description_ka;
    difficulty;
    region;
    distance_km;
    elevation_gain_m;
    estimated_hours;
    route_coordinates;
    start_point;
    end_point;
    start_address;
    gpx_file_url;
    cover_image_url;
    is_published;
}
exports.CreateTrailDto = CreateTrailDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTrailDto.prototype, "name_en", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTrailDto.prototype, "name_ka", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTrailDto.prototype, "description_en", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTrailDto.prototype, "description_ka", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TrailDifficulty),
    __metadata("design:type", String)
], CreateTrailDto.prototype, "difficulty", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTrailDto.prototype, "region", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateTrailDto.prototype, "distance_km", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateTrailDto.prototype, "elevation_gain_m", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateTrailDto.prototype, "estimated_hours", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreateTrailDto.prototype, "route_coordinates", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreateTrailDto.prototype, "start_point", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreateTrailDto.prototype, "end_point", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTrailDto.prototype, "start_address", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTrailDto.prototype, "gpx_file_url", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTrailDto.prototype, "cover_image_url", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateTrailDto.prototype, "is_published", void 0);
//# sourceMappingURL=create-trail.dto.js.map