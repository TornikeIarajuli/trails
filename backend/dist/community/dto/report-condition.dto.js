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
exports.ReportConditionDto = exports.SeverityLevel = exports.ConditionType = void 0;
const class_validator_1 = require("class-validator");
var ConditionType;
(function (ConditionType) {
    ConditionType["TRAIL_CLEAR"] = "trail_clear";
    ConditionType["MUDDY"] = "muddy";
    ConditionType["SNOW"] = "snow";
    ConditionType["FALLEN_TREE"] = "fallen_tree";
    ConditionType["FLOODED"] = "flooded";
    ConditionType["OVERGROWN"] = "overgrown";
    ConditionType["DAMAGED"] = "damaged";
    ConditionType["CLOSED"] = "closed";
})(ConditionType || (exports.ConditionType = ConditionType = {}));
var SeverityLevel;
(function (SeverityLevel) {
    SeverityLevel["INFO"] = "info";
    SeverityLevel["WARNING"] = "warning";
    SeverityLevel["DANGER"] = "danger";
})(SeverityLevel || (exports.SeverityLevel = SeverityLevel = {}));
class ReportConditionDto {
    trail_id;
    condition_type;
    severity;
    description;
    photo_url;
}
exports.ReportConditionDto = ReportConditionDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReportConditionDto.prototype, "trail_id", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(ConditionType),
    __metadata("design:type", String)
], ReportConditionDto.prototype, "condition_type", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(SeverityLevel),
    __metadata("design:type", String)
], ReportConditionDto.prototype, "severity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReportConditionDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReportConditionDto.prototype, "photo_url", void 0);
//# sourceMappingURL=report-condition.dto.js.map