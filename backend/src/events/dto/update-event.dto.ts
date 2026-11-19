import {
  IsOptional,
  IsString,
  IsNotEmpty,
  IsDateString,
  IsInt,
  Max,
  Min,
  MaxLength,
  ArrayMaxSize,
  IsArray,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  EVENT_VISIBILITY,
  EventDayDto,
  MAX_TRIP_DAYS,
} from './trip.dto';
import type { EventVisibility } from './trip.dto';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Must be in the future (checked by the service). */
  @IsOptional()
  @IsDateString()
  scheduled_at?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(1000)
  max_participants?: number;

  /** Public: listed for everyone. Private: only for those with the link. */
  @IsOptional()
  @IsIn(EVENT_VISIBILITY)
  visibility?: EventVisibility;

  /** Day 2 onwards, in order; replaces the earlier days when editing. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TRIP_DAYS - 1)
  @ValidateNested({ each: true })
  @Type(() => EventDayDto)
  days?: EventDayDto[];
}
