import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CheckpointType {
  VIEWPOINT = 'viewpoint',
  WATER_SOURCE = 'water_source',
  CAMPSITE = 'campsite',
  LANDMARK = 'landmark',
  SUMMIT = 'summit',
  SHELTER = 'shelter',
  BRIDGE = 'bridge',
  PASS = 'pass',
  LAKE = 'lake',
  WATERFALL = 'waterfall',
  RUINS = 'ruins',
  CHURCH = 'church',
  TOWER = 'tower',
}

export class CreateCheckpointDto {
  @IsUUID()
  trail_id: string;

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

  @IsEnum(CheckpointType)
  type: CheckpointType;

  @IsArray()
  coordinates: [number, number]; // [lng, lat]

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  elevation_m?: number;

  @IsOptional()
  @IsString()
  photo_url?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_checkable?: boolean;
}
