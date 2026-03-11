import { IsUUID, IsString, IsOptional, IsDateString, IsInt, Min, MaxLength } from 'class-validator';

export class CreateEventDto {
  @IsUUID()
  trail_id: string;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsDateString()
  scheduled_at: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  max_participants?: number;
}
