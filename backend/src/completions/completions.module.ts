import { Module } from '@nestjs/common';
import { CompletionsController } from './completions.controller';
import { CompletionsService } from './completions.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [CompletionsController],
  providers: [CompletionsService, AdminGuard],
  exports: [CompletionsService],
})
export class CompletionsModule {}
