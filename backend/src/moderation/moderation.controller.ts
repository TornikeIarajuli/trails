import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ModerationService } from './moderation.service';
import { ReportContentDto } from './dto/report-content.dto';

@Controller('moderation')
@UseGuards(AuthGuard)
export class ModerationController {
  constructor(private moderationService: ModerationService) {}

  @Post('reports')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  report(@CurrentUser('id') userId: string, @Body() dto: ReportContentDto) {
    return this.moderationService.report(userId, dto);
  }

  @Get('blocks')
  listBlocks(@CurrentUser('id') userId: string) {
    return this.moderationService.listBlocks(userId);
  }

  @Post('blocks/:userId')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  block(
    @CurrentUser('id') userId: string,
    @Param('userId', ParseUUIDPipe) blockedId: string,
  ) {
    return this.moderationService.block(userId, blockedId);
  }

  @Delete('blocks/:userId')
  unblock(
    @CurrentUser('id') userId: string,
    @Param('userId', ParseUUIDPipe) blockedId: string,
  ) {
    return this.moderationService.unblock(userId, blockedId);
  }
}
