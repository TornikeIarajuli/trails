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
import { TrailFilterDto, NearbyQueryDto } from './dto/trail-filter.dto';
import { AdminGuard } from '../common/guards/admin.guard';

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

  @Delete(':id/cache')
  invalidateCache(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-service-key') key: string,
  ) {
    if (key !== process.env.SUPABASE_SERVICE_ROLE_KEY) throw new ForbiddenException();
    this.trailsService.invalidateCache(id);
    return { ok: true };
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.trailsService.remove(id);
  }
}
