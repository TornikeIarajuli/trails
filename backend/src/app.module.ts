import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
})
export class AppModule {}
