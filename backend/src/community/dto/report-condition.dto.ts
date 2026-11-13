import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsLooseUuid } from '../../common/validators/is-loose-uuid';
import { IsStorageUrl } from '../../common/validators/is-storage-url';

export enum ConditionType {
  TRAIL_CLEAR = 'trail_clear',
  MUDDY = 'muddy',
  SNOW = 'snow',
  FALLEN_TREE = 'fallen_tree',
  FLOODED = 'flooded',
  OVERGROWN = 'overgrown',
  DAMAGED = 'damaged',
  CLOSED = 'closed',
}

export enum SeverityLevel {
  INFO = 'info',
  WARNING = 'warning',
  DANGER = 'danger',
}

export class ReportConditionDto {
  @IsLooseUuid()
  trail_id: string;

  @IsEnum(ConditionType)
  condition_type: ConditionType;

  @IsEnum(SeverityLevel)
  severity: SeverityLevel;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsStorageUrl()
  photo_url?: string;
}
