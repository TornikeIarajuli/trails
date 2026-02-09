import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CompletionsService } from './completions.service';
import { SubmitCompletionDto } from './dto/submit-completion.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('completions')
export class CompletionsController {
  constructor(private completionsService: CompletionsService) {}

  @Post()
  @UseGuards(AuthGuard)
  submit(@CurrentUser('id') userId: string, @Body() dto: SubmitCompletionDto) {
    return this.completionsService.submit(userId, dto);
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
  @UseGuards(AuthGuard)
  reviewCompletion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: 'approved' | 'rejected',
    @Body('reviewer_note') reviewerNote?: string,
  ) {
    return this.completionsService.reviewCompletion(id, status, reviewerNote);
  }
}
