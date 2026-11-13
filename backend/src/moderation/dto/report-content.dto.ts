import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const REPORT_TARGET_TYPES = [
  'photo',
  'comment',
  'review',
  'condition',
  'event',
  'user',
  'completion',
  'trail',
] as const;

export const REPORT_REASONS = [
  'spam',
  'offensive',
  'harassment',
  'dangerous',
  'other',
  // About a trail itself (target_type 'trail'), migration 052
  'wrong_route',
  'path_missing',
  'wrong_info',
] as const;

export class ReportContentDto {
  @IsIn(REPORT_TARGET_TYPES)
  target_type: (typeof REPORT_TARGET_TYPES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  target_id: string;

  @IsIn(REPORT_REASONS)
  reason: (typeof REPORT_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}
