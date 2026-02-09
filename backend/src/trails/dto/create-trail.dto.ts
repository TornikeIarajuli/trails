import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TrailDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  ULTRA = 'ultra',
}

export class CreateTrailDto {
  @IsString()
  name_en: string;

  @IsOptional()
  @IsString()
  name_ka?: string;

  @IsOptional()
  @IsString()
  description_en?: string;

  @IsOptional()
  @IsString()
  description_ka?: string;

  @IsEnum(TrailDifficulty)
  difficulty: TrailDifficulty;

  @IsString()
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

  @IsOptional()
  @IsArray()
  route_coordinates?: [number, number][]; // [lng, lat] pairs for LineString

  @IsOptional()
  @IsArray()
  start_point?: [number, number]; // [lng, lat]

  @IsOptional()
  @IsArray()
  end_point?: [number, number]; // [lng, lat]

  @IsOptional()
  @IsString()
  start_address?: string;

  @IsOptional()
  @IsString()
  gpx_file_url?: string;

  @IsOptional()
  @IsString()
  cover_image_url?: string;

  @IsOptional()
  @IsBoolean()
  is_published?: boolean;
}
