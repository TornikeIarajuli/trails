import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('bookmarks')
@UseGuards(AuthGuard)
export class BookmarksController {
  constructor(private bookmarksService: BookmarksService) {}

  @Post(':trailId')
  toggle(
    @CurrentUser('id') userId: string,
    @Param('trailId', ParseUUIDPipe) trailId: string,
  ) {
    return this.bookmarksService.toggle(userId, trailId);
  }

  @Get()
  getMyBookmarks(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bookmarksService.getMyBookmarks(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('check/:trailId')
  isBookmarked(
    @CurrentUser('id') userId: string,
    @Param('trailId', ParseUUIDPipe) trailId: string,
  ) {
    return this.bookmarksService.isBookmarked(userId, trailId);
  }
}
