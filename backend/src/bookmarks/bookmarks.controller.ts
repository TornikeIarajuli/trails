import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import {
  BookmarksQueryDto,
  ToggleBookmarkDto,
  UpdateBookmarkDto,
} from './dto/bookmark.dto';
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
    @Body() dto: ToggleBookmarkDto,
  ) {
    return this.bookmarksService.toggle(userId, trailId, dto.category);
  }

  @Patch(':trailId')
  updateBookmark(
    @CurrentUser('id') userId: string,
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Body() dto: UpdateBookmarkDto,
  ) {
    return this.bookmarksService.updateBookmark(userId, trailId, dto);
  }

  @Get()
  getMyBookmarks(
    @CurrentUser('id') userId: string,
    @Query() query: BookmarksQueryDto,
  ) {
    return this.bookmarksService.getMyBookmarks(
      userId,
      query.page,
      query.limit,
      query.category,
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
