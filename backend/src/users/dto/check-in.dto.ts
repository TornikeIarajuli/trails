import {
  IsISO8601,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsLooseUuid } from '../../common/validators/is-loose-uuid';

/** `?trail_id=` on finishing: only that trail's check-in is closed. */
export class FinishCheckInQueryDto {
  @IsOptional()
  @IsLooseUuid()
  trail_id?: string;
}

/** "Back by": when the hiker will be back from this trail, and where they are now. */
export class CheckInDto {
  @IsLooseUuid()
  trail_id: string;

  @IsISO8601({ strict: true })
  back_by: string;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  lat?: number;

  // Required together with lat
  @ValidateIf(
    (dto: CheckInDto) => dto.lat !== undefined || dto.lng !== undefined,
  )
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  lng?: number;
}
