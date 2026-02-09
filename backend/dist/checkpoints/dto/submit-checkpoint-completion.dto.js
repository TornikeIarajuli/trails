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
exports.SubmitCheckpointCompletionDto = void 0;
const class_validator_1 = require("class-validator");
class SubmitCheckpointCompletionDto {
    checkpoint_id;
    proof_photo_url;
    photo_lat;
    photo_lng;
    completed_at;
}
exports.SubmitCheckpointCompletionDto = SubmitCheckpointCompletionDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SubmitCheckpointCompletionDto.prototype, "checkpoint_id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitCheckpointCompletionDto.prototype, "proof_photo_url", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], SubmitCheckpointCompletionDto.prototype, "photo_lat", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], SubmitCheckpointCompletionDto.prototype, "photo_lng", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitCheckpointCompletionDto.prototype, "completed_at", void 0);
//# sourceMappingURL=submit-checkpoint-completion.dto.js.map