import { IsUUID, IsInt, Min, Max, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitReviewDto {
  @IsUUID()
  trail_id: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
