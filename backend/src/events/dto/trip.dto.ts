import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsLooseUuid } from '../../common/validators/is-loose-uuid';

export const EVENT_VISIBILITY = ['public', 'private'] as const;
export type EventVisibility = (typeof EVENT_VISIBILITY)[number];

/** Day 2 onwards of a multi-day trip; day 1 is the event's own trail. */
export const MAX_TRIP_DAYS = 14;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimOrUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

/** A further day of a trip: a trail, or a day without one ("Rest day in Mestia"). */
export class EventDayDto {
  @IsOptional()
  @IsLooseUuid()
  trail_id?: string;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** A chat message on a trip. */
export class EventMessageDto {
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(1000)
  body: string;
}

/** `?before=` (an older message's time) and `?limit=` for paging back through the chat. */
export class EventMessagesQueryDto {
  @IsOptional()
  @IsDateString()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

