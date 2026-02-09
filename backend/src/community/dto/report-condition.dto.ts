import { IsUUID, IsEnum, IsOptional, IsString } from 'class-validator';

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
  @IsUUID()
  trail_id: string;

  @IsEnum(ConditionType)
  condition_type: ConditionType;

  @IsEnum(SeverityLevel)
  severity: SeverityLevel;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  photo_url?: string;
}
