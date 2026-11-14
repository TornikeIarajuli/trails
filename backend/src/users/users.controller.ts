import {
  Controller,
  Get,
  Patch,
  Post,
  Put,
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
import { UsersService } from './users.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { EmergencyContactDto, SosDto } from './dto/safety.dto';
import { SearchUsersQueryDto } from './dto/search-users.dto';
import { CheckInDto, FinishCheckInQueryDto } from './dto/check-in.dto';
import { CheckinsService } from './checkins.service';

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private checkinsService: CheckinsService,
  ) {}

  @Get('me')
  @UseGuards(AuthGuard)
  getMyProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Delete('me')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMyAccount(@CurrentUser('id') userId: string) {
    return this.usersService.deleteAccount(userId);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Get('me/export')
  @UseGuards(AuthGuard)
  exportMyData(@CurrentUser('id') userId: string) {
    return this.usersService.exportUserData(userId);
  }

  // Declared before ':id/regions' so "me" is not taken for a user id
  @Get('me/regions')
  @UseGuards(AuthGuard)
  getMyRegions(@CurrentUser('id') userId: string) {
    return this.usersService.getRegionProgress(userId);
  }

  @Get('search')
  @UseGuards(AuthGuard)
  searchUsers(@Query() query: SearchUsersQueryDto) {
    return this.usersService.searchUsers(query.q ?? '');
  }

  /** Hikers to follow, for Discover. Declared before ':id' so "suggested" is not taken for an id. */
  @Get('suggested')
  @UseGuards(AuthGuard)
  getSuggestedHikers(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationDto,
  ) {
    return this.usersService.getSuggestedHikers(userId, query.limit);
  }

  @Get('leaderboard')
  getLeaderboard(@Query() query: PaginationDto) {
    return this.usersService.getLeaderboard(query.limit ?? 20);
  }

  @Patch('me/emergency-contact')
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  setEmergencyContact(
    @CurrentUser('id') userId: string,
    @Body() dto: EmergencyContactDto,
  ) {
    return this.usersService.setEmergencyContact(userId, dto.contact_user_id);
  }

  @Patch('me/heartbeat')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  heartbeat(@CurrentUser('id') userId: string) {
    return this.usersService.heartbeat(userId);
  }

  /** "Back by": the open check-in and who would be alerted. */
  @Get('me/check-in')
  @UseGuards(AuthGuard)
  getCheckIn(@CurrentUser('id') userId: string) {
    return this.checkinsService.get(userId);
  }

  /** Starts or updates the check-in of the hike in progress (time, latest position). */
  @Put('me/check-in')
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  setCheckIn(@CurrentUser('id') userId: string, @Body() dto: CheckInDto) {
    return this.checkinsService.set(userId, dto);
  }

  /** The hiker is back. */
  @Delete('me/check-in')
  @UseGuards(AuthGuard)
  finishCheckIn(
    @CurrentUser('id') userId: string,
    @Query() query: FinishCheckInQueryDto,
  ) {
    return this.checkinsService.finish(userId, query.trail_id);
  }

  @Post('me/sos')
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  triggerSos(@CurrentUser('id') userId: string, @Body() dto: SosDto) {
    return this.usersService.triggerSos(userId, dto.lat, dto.lng);
  }

  @Get(':id/regions')
  getUserRegions(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getRegionProgress(id);
  }

  @Get(':id')
  getPublicProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getPublicProfile(id);
  }
}
