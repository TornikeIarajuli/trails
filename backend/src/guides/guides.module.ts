import { Module } from '@nestjs/common';
import { BookingsController, GuidesController } from './guides.controller';
import { GuidesService } from './guides.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [GuidesController, BookingsController],
  providers: [GuidesService],
})
export class GuidesModule {}
