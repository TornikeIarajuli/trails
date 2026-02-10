import { Module } from '@nestjs/common';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';
import { SupabaseService } from '../config/supabase.config';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [FollowsController],
  providers: [FollowsService, SupabaseService],
  exports: [FollowsService],
})
export class FollowsModule {}
