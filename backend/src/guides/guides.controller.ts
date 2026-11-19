import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GuidesService } from './guides.service';
import {
  CreateBookingDto,
  GuideProfileDto,
  GuidesQueryDto,
  UpdateBookingDto,
} from './dto/guide.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('guides')
export class GuidesController {
  constructor(private guidesService: GuidesService) {}

  /** Verified guides: `?region=` or `?trail_id=` (listed on it, or guiding in its region). */
  @Get()
  list(@Query() query: GuidesQueryDto) {
    return this.guidesService.list(query);
  }

  /** Your own guide profile, whatever its status (null when you never applied). */
  @Get('me')
  @UseGuards(AuthGuard)
  getMine(@CurrentUser('id') userId: string) {
    return this.guidesService.getMine(userId);
  }

  /** Apply, or update your profile. */
  @Put('me')
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  saveMine(@CurrentUser('id') userId: string, @Body() dto: GuideProfileDto) {
    return this.guidesService.saveMine(userId, dto);
  }

  @Get(':userId')
  getPublic(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.guidesService.getPublic(userId);
  }

  /** Phone and messengers: for hikers whose request the guide accepted. */
  @Get(':userId/contact')
  @UseGuards(AuthGuard)
  getContact(
    @CurrentUser('id') requesterId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.guidesService.getContact(requesterId, userId);
  }
}

@Controller('bookings')
@UseGuards(AuthGuard)
export class BookingsController {
  constructor(private guidesService: GuidesService) {}

  /** Your requests as a hiker, and the requests to you as a guide. */
  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.guidesService.listBookings(userId);
  }

  @Post()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateBookingDto) {
    return this.guidesService.createBooking(userId, dto);
  }

  /** The guide accepts or declines; the hiker cancels. */
  @Patch(':id')
  answer(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.guidesService.answerBooking(userId, id, dto.status, dto.reply);
  }
}
