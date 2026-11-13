import {
  IsOptional,
  IsEnum,
  IsString,
  IsNumber,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TrailDifficulty } from './create-trail.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class TrailFilterDto extends PaginationDto {
  // The map view of released app builds asks for 200 trails at once, so this list keeps
  // a higher cap than the shared 100. Redeclaring the property replaces the inherited
  // validators.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(TrailDifficulty)
  difficulty?: TrailDifficulty;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  min_distance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  max_distance?: number;
}

export class RecommendationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number;
}

export class NearbyQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(300)
  radius_km?: number = 50;
}
