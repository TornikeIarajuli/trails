import { Module } from '@nestjs/common';
import {
  InternalOutlookController,
  OutlookController,
} from './outlook.controller';
import { OutlookService } from './outlook.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [OutlookController, InternalOutlookController],
  providers: [OutlookService],
})
export class OutlookModule {}
