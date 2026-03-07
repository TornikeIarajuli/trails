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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  findAll(@Query('trail_id') trailId?: string) {
    return this.eventsService.findAll(trailId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(
    @CurrentUser('id') userId: string,
    @Body()
    dto: {
      trail_id: string;
      title: string;
      description?: string;
      scheduled_at: string;
      max_participants?: number;
    },
  ) {
    return this.eventsService.create(userId, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  delete(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.eventsService.delete(userId, id);
  }

  @Post(':id/join')
  @UseGuards(AuthGuard)
  join(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.eventsService.join(userId, id);
  }

  @Delete(':id/leave')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  leave(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.eventsService.leave(userId, id);
  }
}
