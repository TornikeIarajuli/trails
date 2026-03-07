import {
  Controller,
  Post,
  Delete,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
  removeToken(@CurrentUser('id') userId: string, @Body('token') token: string) {
    return this.notificationsService.removeToken(userId, token);
  }

  @Get()
  @UseGuards(AuthGuard)
  getNotifications(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
  ) {
    return this.notificationsService.getNotifications(
      userId,
      page ? parseInt(page) : 1,
    );
  }

  @Patch(':id/read')
  @UseGuards(AuthGuard)
  markRead(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markRead(userId, id);
  }

  @Patch('read-all')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Get('preferences')
  @UseGuards(AuthGuard)
  getPreferences(@CurrentUser('id') userId: string) {
    return this.notificationsService.getPreferences(userId);
  }

  @Patch('preferences')
  @UseGuards(AuthGuard)
  updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() prefs: Record<string, boolean>,
  ) {
    return this.notificationsService.updatePreferences(userId, prefs);
  }
}
