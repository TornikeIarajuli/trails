import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FeedService } from './feed.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('feed')
@UseGuards(AuthGuard)
export class FeedController {
  constructor(private feedService: FeedService) {}

  @Get()
  getFeed(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.feedService.getFeed(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }
}
