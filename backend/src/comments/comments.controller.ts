import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get(':activityId')
  getComments(
    @Param('activityId') activityId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.commentsService.getComments(
      activityId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post()
  @UseGuards(AuthGuard)
  createComment(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createComment(userId, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  deleteComment(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.commentsService.deleteComment(userId, id);
  }

  // ── Likes ──────────────────────────────────────────────────────────────────

  @Get('likes/:activityId')
  getLikes(@Param('activityId') activityId: string) {
    return this.commentsService.getLikes(activityId);
  }

  @Post('likes/toggle')
  @UseGuards(AuthGuard)
  toggleLike(
    @CurrentUser('id') userId: string,
    @Body('activity_id') activityId: string,
    @Body('activity_type') activityType: string,
  ) {
    return this.commentsService.toggleLike(userId, activityId, activityType);
  }
}
