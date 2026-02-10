import { Controller, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('register-token')
  @UseGuards(AuthGuard)
  registerToken(
    @CurrentUser('id') userId: string,
    @Body('token') token: string,
    @Body('platform') platform?: string,
  ) {
    return this.notificationsService.registerToken(userId, token, platform);
  }

  @Delete('remove-token')
  @UseGuards(AuthGuard)
  removeToken(
    @CurrentUser('id') userId: string,
    @Body('token') token: string,
  ) {
    return this.notificationsService.removeToken(userId, token);
  }
}
