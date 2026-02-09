"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckpointsModule = void 0;
const common_1 = require("@nestjs/common");
const checkpoints_controller_1 = require("./checkpoints.controller");
const checkpoints_service_1 = require("./checkpoints.service");
const supabase_config_1 = require("../config/supabase.config");
let CheckpointsModule = class CheckpointsModule {
};
exports.CheckpointsModule = CheckpointsModule;
exports.CheckpointsModule = CheckpointsModule = __decorate([
    (0, common_1.Module)({
        controllers: [checkpoints_controller_1.CheckpointsController],
        providers: [checkpoints_service_1.CheckpointsService, supabase_config_1.SupabaseService],
        exports: [checkpoints_service_1.CheckpointsService],
    })
], CheckpointsModule);
//# sourceMappingURL=checkpoints.module.js.map