import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
  @Throttle({ default: { ttl: 60000, limit: 10 } })
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

  @Patch(':id')
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 15 } })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: {
      title?: string;
      description?: string;
      scheduled_at?: string;
      max_participants?: number;
    },
  ) {
    return this.eventsService.update(userId, id, dto);
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
  @Throttle({ default: { ttl: 60000, limit: 10 } })
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
