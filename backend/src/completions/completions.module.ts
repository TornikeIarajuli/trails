import { Module } from '@nestjs/common';
import { CompletionsController } from './completions.controller';
import { CompletionsService } from './completions.service';
import { SupabaseService } from '../config/supabase.config';
import { AdminGuard } from '../common/guards/admin.guard';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [CompletionsController],
  providers: [CompletionsService, SupabaseService, AdminGuard],
  exports: [CompletionsService],
})
export class CompletionsModule {}
