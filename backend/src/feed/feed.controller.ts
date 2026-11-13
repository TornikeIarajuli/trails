import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FeedService } from './feed.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('feed')
@UseGuards(AuthGuard)
export class FeedController {
  constructor(private feedService: FeedService) {}

  @Get()
  getFeed(@CurrentUser('id') userId: string, @Query() query: PaginationDto) {
    return this.feedService.getFeed(userId, query.page, query.limit);
  }
}
