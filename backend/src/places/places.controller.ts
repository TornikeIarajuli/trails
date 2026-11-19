import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { PlacesService } from './places.service';
import { PlacesQueryDto } from './dto/places-query.dto';

/** Named outdoor places beyond the trails (lakes, peaks, waterfalls, castles…). Public. */
@Controller('places')
export class PlacesController {
  constructor(private placesService: PlacesService) {}

  /**
   * `?kind=&region=&q=` (most notable first) or `?near=lat,lng&radius_km=` (nearest first, with
   * distance_km); `limit` and `offset` page through either. Answers `{ data, total }`.
   */
  @Get()
  list(@Query() query: PlacesQueryDto) {
    return this.placesService.list(query);
  }

  /** One place, with the trails and places around it. */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.placesService.findOne(id);
  }
}
