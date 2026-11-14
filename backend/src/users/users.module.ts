import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CheckinsService } from './checkins.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TrailsModule } from '../trails/trails.module';

@Module({
  imports: [NotificationsModule, TrailsModule],
  controllers: [UsersController],
  providers: [UsersService, CheckinsService],
  exports: [UsersService],
})
export class UsersModule {}
