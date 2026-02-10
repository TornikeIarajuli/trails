import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SupabaseService } from '../config/supabase.config';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, SupabaseService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
