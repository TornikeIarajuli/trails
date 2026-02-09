import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
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
  name_en?: string;

  @IsOptional()
  @IsString()
  name_ka?: string;

  @IsOptional()
  @IsString()
  description_en?: string;

  @IsOptional()
  @IsString()
  description_ka?: string;

  @IsOptional()
  @IsEnum(TrailDifficulty)
  difficulty?: TrailDifficulty;

  @IsOptional()
  @IsString()
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
  start_address?: string;

  @IsOptional()
  @IsString()
  cover_image_url?: string;

  @IsOptional()
  @IsBoolean()
  is_published?: boolean;
}
