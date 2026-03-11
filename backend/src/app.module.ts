import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { SentryModule } from '@sentry/nestjs/setup';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { ProxyThrottlerGuard } from './common/guards/proxy-throttler.guard';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { HealthModule } from './health/health.module';
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
import { CommentsModule } from './comments/comments.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute window
        limit: 60, // 60 requests per minute per IP
      },
    ]),
    HealthModule,
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
    CommentsModule,
    EventsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_GUARD, useClass: ProxyThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
