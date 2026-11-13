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
import { IsLooseUuid } from '../../common/validators/is-loose-uuid';
import { IsLngLat } from '../../common/validators/geo';

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
  @IsLooseUuid()
  trail_id: string;

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
  @MaxLength(5000)
  description_en?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description_ka?: string;

  @IsEnum(CheckpointType)
  type: CheckpointType;

  // Written into an EWKT string, so only finite in-range numbers are accepted
  @IsLngLat()
  coordinates: [number, number]; // [lng, lat]

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  elevation_m?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
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
