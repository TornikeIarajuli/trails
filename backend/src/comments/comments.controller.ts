import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get(':activityId')
  getComments(@Param('activityId') activityId: string) {
    return this.commentsService.getComments(activityId);
  }

  @Post()
  @UseGuards(AuthGuard)
  createComment(@CurrentUser('id') userId: string, @Body() dto: CreateCommentDto) {
    return this.commentsService.createComment(userId, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  deleteComment(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.commentsService.deleteComment(userId, id);
  }
}
