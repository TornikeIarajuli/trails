import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { SupabaseService } from '../config/supabase.config';

@Module({
  controllers: [FeedController],
  providers: [FeedService, SupabaseService],
})
export class FeedModule {}
