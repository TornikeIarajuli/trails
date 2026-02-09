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
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { ReportConditionDto } from './dto/report-condition.dto';
import { UploadPhotoDto } from './dto/upload-photo.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('community')
export class CommunityController {
  constructor(private communityService: CommunityService) {}

  // ---- Conditions ----

  @Post('conditions')
  @UseGuards(AuthGuard)
  reportCondition(
    @CurrentUser('id') userId: string,
    @Body() dto: ReportConditionDto,
  ) {
    return this.communityService.reportCondition(userId, dto);
  }

  @Get('conditions/:trailId')
  getTrailConditions(@Param('trailId', ParseUUIDPipe) trailId: string) {
    return this.communityService.getTrailConditions(trailId);
  }

  @Delete('conditions/:id')
  @UseGuards(AuthGuard)
  deactivateCondition(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communityService.deactivateCondition(userId, id);
  }

  // ---- Photos ----

  @Post('photos')
  @UseGuards(AuthGuard)
  uploadPhoto(
    @CurrentUser('id') userId: string,
    @Body() dto: UploadPhotoDto,
  ) {
    return this.communityService.uploadPhoto(userId, dto);
  }

  @Get('photos/:trailId')
  getTrailPhotos(
    @Param('trailId', ParseUUIDPipe) trailId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communityService.getTrailPhotos(
      trailId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Post('photos/:id/like')
  @UseGuards(AuthGuard)
  toggleLike(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communityService.toggleLike(userId, id);
  }

  @Delete('photos/:id')
  @UseGuards(AuthGuard)
  deletePhoto(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communityService.deletePhoto(userId, id);
  }
}
