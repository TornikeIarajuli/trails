import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitReviewDto {
  @IsString()
  @IsNotEmpty()
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
