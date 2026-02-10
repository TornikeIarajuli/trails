import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { BadgesService } from './badges.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('badges')
export class BadgesController {
  constructor(private badgesService: BadgesService) {}

  @Get()
  getAllBadges() {
    return this.badgesService.getAllBadges();
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getMyBadges(@CurrentUser('id') userId: string) {
    return this.badgesService.getUserBadges(userId);
  }

  @Get('progress')
  @UseGuards(AuthGuard)
  getProgress(@CurrentUser('id') userId: string) {
    return this.badgesService.getProgress(userId);
  }

  @Post('check')
  @UseGuards(AuthGuard)
  checkBadges(@CurrentUser('id') userId: string) {
    return this.badgesService.checkAndAward(userId);
  }
}
