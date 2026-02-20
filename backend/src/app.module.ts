import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { SentryModule } from '@sentry/nestjs/setup';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { AuthModule } from './auth/auth.module';
import { TrailsModule } from './trails/trails.module';
import { MediaModule } from './media/media.module';
import { CompletionsModule } from './completions/completions.module';
import { UsersModule } from './users/users.module';
import { CheckpointsModule } from './checkpoints/checkpoints.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { BadgesModule } from './badges/badges.module';
import { CommunityModule } from './community/community.module';
import { ReviewsModule } from './reviews/reviews.module';
import { FollowsModule } from './follows/follows.module';
import { FeedModule } from './feed/feed.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ShopModule } from './shop/shop.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,   // 1 minute window
      limit: 60,    // 60 requests per minute per IP
    }]),
    AuthModule,
    TrailsModule,
    MediaModule,
    CompletionsModule,
    UsersModule,
    CheckpointsModule,
    BookmarksModule,
    BadgesModule,
    CommunityModule,
    ReviewsModule,
    FollowsModule,
    FeedModule,
    NotificationsModule,
    ShopModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
