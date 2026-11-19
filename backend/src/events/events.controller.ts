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
import { CreateEventDto, EventsQueryDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventMessageDto, EventMessagesQueryDto } from './dto/trip.dto';

@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  findAll(@Query() query: EventsQueryDto) {
    return this.eventsService.findAll(query.trail_id);
  }

  /** Your trips and group hikes, public or private, until their last day. */
  @Get('mine')
  @UseGuards(AuthGuard)
  findMine(@CurrentUser('id') userId: string) {
    return this.eventsService.findMine(userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.findOne(id);
  }

  /** The trip's chat, for those who joined. */
  @Get(':id/messages')
  @UseGuards(AuthGuard)
  listMessages(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: EventMessagesQueryDto,
  ) {
    return this.eventsService.listMessages(
      userId,
      id,
      query.before,
      query.limit ?? 50,
    );
  }

  @Post(':id/messages')
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  postMessage(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EventMessageDto,
  ) {
    return this.eventsService.postMessage(userId, id, dto.body);
  }

  @Delete(':id/messages/:messageId')
  @UseGuards(AuthGuard)
  deleteMessage(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.eventsService.deleteMessage(userId, id, messageId);
  }

  @Post()
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateEventDto) {
    return this.eventsService.create(userId, dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 15 } })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
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
