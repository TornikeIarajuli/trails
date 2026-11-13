import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsLngLat, IsLngLatList } from '../../common/validators/geo';

export enum TrailDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  ULTRA = 'ultra',
}

export class CreateTrailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name_en: string;

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

  @IsEnum(TrailDifficulty)
  difficulty: TrailDifficulty;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  region: string;

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

  // These end up in EWKT strings, so only finite in-range numbers are accepted.
  @IsOptional()
  @IsLngLatList(10000)
  route_coordinates?: [number, number][]; // [lng, lat] pairs for LineString

  @IsOptional()
  @IsLngLat()
  start_point?: [number, number]; // [lng, lat]

  @IsOptional()
  @IsLngLat()
  end_point?: [number, number]; // [lng, lat]

  @IsOptional()
  @IsString()
  @MaxLength(500)
  start_address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  gpx_file_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cover_image_url?: string;

  @IsOptional()
  @IsBoolean()
  is_published?: boolean;
}
