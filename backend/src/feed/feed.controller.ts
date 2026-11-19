import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
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

  /** Everyone's posts, best first: the Discover segment of the Feed tab. */
  @Get('discover')
  getDiscover(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationDto,
  ) {
    return this.feedService.getDiscover(userId, query.page, query.limit);
  }

  /** The caller's saved posts, most recently saved first. */
  @Get('saved')
  getSaved(@CurrentUser('id') userId: string, @Query() query: PaginationDto) {
    return this.feedService.getSaved(userId, query.page, query.limit);
  }

  /** Saves a post for later. */
  @Put('saved/:id')
  savePost(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.feedService.savePost(userId, id);
  }

  /** Takes a post off the saved list. */
  @Delete('saved/:id')
  unsavePost(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.feedService.unsavePost(userId, id);
  }

  /** One post, for notification taps ("nino liked your hike"). */
  @Get('activity/:id')
  getActivity(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.feedService.getActivity(userId, id);
  }
}
