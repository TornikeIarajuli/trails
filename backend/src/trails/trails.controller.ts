import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { TrailsService } from './trails.service';
import { CreateTrailDto } from './dto/create-trail.dto';
import { UpdateTrailDetailsDto } from './dto/update-trail-details.dto';
import {
  TrailFilterDto,
  NearbyQueryDto,
  RecommendationsQueryDto,
} from './dto/trail-filter.dto';
import { AdminGuard } from '../common/guards/admin.guard';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { isAuthorizedInternalCall } from '../common/internal-key';

@Controller('trails')
export class TrailsController {
  constructor(private trailsService: TrailsService) {}

  @Get()
  findAll(@Query() filter: TrailFilterDto) {
    return this.trailsService.findAll(filter);
  }

  @Get('regions')
  getRegions() {
    return this.trailsService.getRegions();
  }

  @Get('recommendations')
  @UseGuards(AuthGuard)
  getRecommendations(
    @CurrentUser('id') userId: string,
    @Query() query: RecommendationsQueryDto,
  ) {
    return this.trailsService.getRecommendations(userId, query.limit ?? 10);
  }

  @Get('nearby')
  findNearby(@Query() query: NearbyQueryDto) {
    return this.trailsService.findNearby(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.trailsService.findOne(id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateTrailDto) {
    return this.trailsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTrailDetailsDto,
  ) {
    return this.trailsService.updateDetails(id, dto);
  }

  /** Called by the admin panel after it changed a trail directly in the database. */
  @Delete(':id/cache')
  invalidateCache(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    if (!isAuthorizedInternalCall(headers)) throw new ForbiddenException();
    this.trailsService.invalidateCache(id);
    return { ok: true };
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.trailsService.remove(id);
  }
}
