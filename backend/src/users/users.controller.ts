import {
  Controller,
  Get,
  Patch,
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
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { EmergencyContactDto, SosDto } from './dto/safety.dto';
import { SearchUsersQueryDto } from './dto/search-users.dto';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

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

  @Get('search')
  @UseGuards(AuthGuard)
  searchUsers(@Query() query: SearchUsersQueryDto) {
    return this.usersService.searchUsers(query.q ?? '');
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

  @Post('me/sos')
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  triggerSos(@CurrentUser('id') userId: string, @Body() dto: SosDto) {
    return this.usersService.triggerSos(userId, dto.lat, dto.lng);
  }

  @Get(':id')
  getPublicProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getPublicProfile(id);
  }
}
