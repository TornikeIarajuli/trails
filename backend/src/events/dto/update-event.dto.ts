import {
  IsOptional,
  IsString,
  IsNotEmpty,
  IsDateString,
  IsInt,
  Max,
  Min,
  MaxLength,
} from 'class-validator';

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
}
