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
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CompletionsService } from './completions.service';
import { SubmitCompletionDto } from './dto/submit-completion.dto';
import { RecordHikeDto } from './dto/record-hike.dto';
import { ReviewCompletionDto } from './dto/review-completion.dto';
import { MarkPastHikeDto } from './dto/mark-past-hike.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('completions')
export class CompletionsController {
  constructor(private completionsService: CompletionsService) {}

  @Post()
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  submit(@CurrentUser('id') userId: string, @Body() dto: SubmitCompletionDto) {
    return this.completionsService.submit(userId, dto);
  }

  @Post('record')
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  recordHike(@CurrentUser('id') userId: string, @Body() dto: RecordHikeDto) {
    return this.completionsService.recordHike(userId, dto);
  }

  /** 201 when the trail is marked now, 200 when it already was (contract C7). */
  @Post('past')
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async markPastHike(
    @CurrentUser('id') userId: string,
    @Body() dto: MarkPastHikeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.completionsService.markPastHike(userId, dto);
    res.status(result.already_existed ? HttpStatus.OK : HttpStatus.CREATED);
    return result;
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
    @Body() dto: ReviewCompletionDto,
  ) {
    return this.completionsService.reviewCompletion(
      id,
      dto.status,
      dto.reviewer_note,
    );
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
