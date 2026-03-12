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
import { BookmarksService, BookmarkCategory } from './bookmarks.service';
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
    @Body('category') category?: BookmarkCategory,
  ) {
    return this.bookmarksService.toggle(userId, trailId, category);
  }

  @Patch(':trailId')
  updateBookmark(
    @CurrentUser('id') userId: string,
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Body() body: { category?: BookmarkCategory; note?: string | null },
  ) {
    return this.bookmarksService.updateBookmark(userId, trailId, body);
  }

  @Get()
  getMyBookmarks(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ) {
    return this.bookmarksService.getMyBookmarks(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      category,
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
