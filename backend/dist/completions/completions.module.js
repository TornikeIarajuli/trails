"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompletionsModule = void 0;
const common_1 = require("@nestjs/common");
const completions_controller_1 = require("./completions.controller");
const completions_service_1 = require("./completions.service");
const supabase_config_1 = require("../config/supabase.config");
const notifications_module_1 = require("../notifications/notifications.module");
let CompletionsModule = class CompletionsModule {
};
exports.CompletionsModule = CompletionsModule;
exports.CompletionsModule = CompletionsModule = __decorate([
    (0, common_1.Module)({
        imports: [notifications_module_1.NotificationsModule],
        controllers: [completions_controller_1.CompletionsController],
        providers: [completions_service_1.CompletionsService, supabase_config_1.SupabaseService],
        exports: [completions_service_1.CompletionsService],
    })
], CompletionsModule);
//# sourceMappingURL=completions.module.js.map