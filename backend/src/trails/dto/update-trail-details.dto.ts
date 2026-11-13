import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TrailDifficulty } from './create-trail.dto';

/**
 * DTO for admin trail editing — excludes coordinate/route fields.
 * Admins can edit descriptions, metadata, images, etc. but NOT the GPS route.
 */
export class UpdateTrailDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name_en?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name_ka?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description_en?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description_ka?: string;

  @IsOptional()
  @IsEnum(TrailDifficulty)
  difficulty?: TrailDifficulty;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distance_km?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  elevation_gain_m?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimated_hours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  start_address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cover_image_url?: string;

  @IsOptional()
  @IsBoolean()
  is_published?: boolean;
}
