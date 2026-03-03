import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CompletionsService } from './completions.service';
import { SubmitCompletionDto } from './dto/submit-completion.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('completions')
export class CompletionsController {
  constructor(private completionsService: CompletionsService) {}

  @Post()
  @UseGuards(AuthGuard)
  submit(@CurrentUser('id') userId: string, @Body() dto: SubmitCompletionDto) {
    return this.completionsService.submit(userId, dto);
  }

  @Post('record')
  @UseGuards(AuthGuard)
  recordHike(
    @CurrentUser('id') userId: string,
    @Body('trail_id') trailId: string,
    @Body('elapsed_seconds') elapsedSeconds?: number,
  ) {
    return this.completionsService.recordHike(userId, trailId, elapsedSeconds);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getMyCompletions(@CurrentUser('id') userId: string) {
    return this.completionsService.getUserCompletions(userId);
  }

  @Get('trail/:trailId')
  getTrailCompletions(@Param('trailId', ParseUUIDPipe) trailId: string) {
    return this.completionsService.getTrailCompletions(trailId);
  }

  @Patch(':id/review')
  @UseGuards(AdminGuard)
  reviewCompletion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: 'approved' | 'rejected',
    @Body('reviewer_note') reviewerNote?: string,
  ) {
    return this.completionsService.reviewCompletion(id, status, reviewerNote);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  deleteCompletion(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.completionsService.deleteCompletion(userId, id);
  }

  @Post('active/:trailId')
  @UseGuards(AuthGuard)
  markActive(
    @CurrentUser('id') userId: string,
    @Param('trailId', ParseUUIDPipe) trailId: string,
  ) {
    return this.completionsService.markHikeActive(userId, trailId);
  }

  @Delete('active/:trailId')
  @UseGuards(AuthGuard)
  markInactive(
    @CurrentUser('id') userId: string,
    @Param('trailId', ParseUUIDPipe) trailId: string,
  ) {
    return this.completionsService.markHikeInactive(userId, trailId);
  }

  @Get('active/:trailId/count')
  getActiveCount(@Param('trailId', ParseUUIDPipe) trailId: string) {
    return this.completionsService.getActiveCount(trailId);
  }
}
