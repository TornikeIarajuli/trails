import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FollowsService } from './follows.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('follows')
@UseGuards(AuthGuard)
export class FollowsController {
  constructor(private followsService: FollowsService) {}

  @Post(':userId')
  toggle(
    @CurrentUser('id') currentUserId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.followsService.toggle(currentUserId, targetUserId);
  }

  @Get('check/:userId')
  isFollowing(
    @CurrentUser('id') currentUserId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.followsService.isFollowing(currentUserId, targetUserId);
  }

  @Get('followers/:userId')
  getFollowers(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.followsService.getFollowers(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('following/:userId')
  getFollowing(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.followsService.getFollowing(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('counts/:userId')
  getCounts(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.followsService.getCounts(userId);
  }
}
