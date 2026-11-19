import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class OutlookQueryDto {
  /** Today and the days after it: 1 is today only, 7 the whole week. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  days?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class RunOutlookDto {
  /** Run again even when today's outlook is done. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
