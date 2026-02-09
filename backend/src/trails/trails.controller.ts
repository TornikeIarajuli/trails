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
} from '@nestjs/common';
import { TrailsService } from './trails.service';
import { CreateTrailDto } from './dto/create-trail.dto';
import { UpdateTrailDetailsDto } from './dto/update-trail-details.dto';
import { TrailFilterDto, NearbyQueryDto } from './dto/trail-filter.dto';
import { AuthGuard } from '../common/guards/auth.guard';
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

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.trailsService.remove(id);
  }
}
