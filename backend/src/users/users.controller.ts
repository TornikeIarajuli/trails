import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  getMyProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Delete('me')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMyAccount(@CurrentUser('id') userId: string) {
    return this.usersService.deleteAccount(userId);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() data: { full_name?: string; bio?: string },
  ) {
    return this.usersService.updateProfile(userId, data);
  }

  @Get('search')
  @UseGuards(AuthGuard)
  searchUsers(@Query('q') q: string) {
    return this.usersService.searchUsers(q || '');
  }

  @Get('leaderboard')
  getLeaderboard(@Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : 20;
    return this.usersService.getLeaderboard(Math.min(parsed || 20, 100));
  }

  @Patch('me/emergency-contact')
  @UseGuards(AuthGuard)
  setEmergencyContact(
    @CurrentUser('id') userId: string,
    @Body('contact_user_id') contactUserId: string | null,
  ) {
    return this.usersService.setEmergencyContact(userId, contactUserId);
  }

  @Post('me/sos')
  @UseGuards(AuthGuard)
  triggerSos(
    @CurrentUser('id') userId: string,
    @Body('lat') lat: number,
    @Body('lng') lng: number,
  ) {
    return this.usersService.triggerSos(userId, lat, lng);
  }

  @Get(':id')
  getPublicProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getPublicProfile(id);
  }
}
