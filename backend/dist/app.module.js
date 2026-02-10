"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const auth_module_1 = require("./auth/auth.module");
const trails_module_1 = require("./trails/trails.module");
const media_module_1 = require("./media/media.module");
const completions_module_1 = require("./completions/completions.module");
const users_module_1 = require("./users/users.module");
const checkpoints_module_1 = require("./checkpoints/checkpoints.module");
const bookmarks_module_1 = require("./bookmarks/bookmarks.module");
const badges_module_1 = require("./badges/badges.module");
const community_module_1 = require("./community/community.module");
const reviews_module_1 = require("./reviews/reviews.module");
const follows_module_1 = require("./follows/follows.module");
const feed_module_1 = require("./feed/feed.module");
const notifications_module_1 = require("./notifications/notifications.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            auth_module_1.AuthModule,
            trails_module_1.TrailsModule,
            media_module_1.MediaModule,
            completions_module_1.CompletionsModule,
            users_module_1.UsersModule,
            checkpoints_module_1.CheckpointsModule,
            bookmarks_module_1.BookmarksModule,
            badges_module_1.BadgesModule,
            community_module_1.CommunityModule,
            reviews_module_1.ReviewsModule,
            follows_module_1.FollowsModule,
            feed_module_1.FeedModule,
            notifications_module_1.NotificationsModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map