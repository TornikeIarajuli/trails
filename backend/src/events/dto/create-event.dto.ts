import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsInt,
  Max,
  Min,
  MaxLength,
} from 'class-validator';
import { IsLooseUuid } from '../../common/validators/is-loose-uuid';

export class CreateEventDto {
  @IsLooseUuid()
  trail_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Must be in the future (checked by the service). */
  @IsDateString()
  scheduled_at: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(1000)
  max_participants?: number;
}

export class EventsQueryDto {
  @IsOptional()
  @IsLooseUuid()
  trail_id?: string;
}
