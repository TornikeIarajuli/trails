import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ToggleLikeDto } from './dto/toggle-like.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get(':activityId')
  getComments(
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Query() query: PaginationDto,
  ) {
    return this.commentsService.getComments(
      activityId,
      query.page,
      query.limit,
    );
  }

  @Post()
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  createComment(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createComment(userId, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  deleteComment(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.commentsService.deleteComment(userId, id);
  }

  // ── Likes ──────────────────────────────────────────────────────────────────

  @Get('likes/:activityId')
  getLikes(@Param('activityId', ParseUUIDPipe) activityId: string) {
    return this.commentsService.getLikes(activityId);
  }

  @Post('likes/toggle')
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  toggleLike(@CurrentUser('id') userId: string, @Body() dto: ToggleLikeDto) {
    return this.commentsService.toggleLike(
      userId,
      dto.activity_id,
      dto.activity_type,
    );
  }
}
