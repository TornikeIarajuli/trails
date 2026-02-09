import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
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

  @Patch('me')
  @UseGuards(AuthGuard)
  updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() data: { full_name?: string; bio?: string; avatar_url?: string },
  ) {
    return this.usersService.updateProfile(userId, data);
  }

  @Get('search')
  searchUsers(@Query('q') q: string) {
    return this.usersService.searchUsers(q || '');
  }

  @Get('leaderboard')
  getLeaderboard(@Query('limit') limit?: string) {
    return this.usersService.getLeaderboard(limit ? parseInt(limit, 10) : 20);
  }

  @Get(':id')
  getPublicProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getPublicProfile(id);
  }
}
