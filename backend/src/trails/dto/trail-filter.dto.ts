import { IsOptional, IsEnum, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TrailDifficulty } from './create-trail.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class TrailFilterDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TrailDifficulty)
  difficulty?: TrailDifficulty;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_distance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  max_distance?: number;
}

export class NearbyQueryDto {
  @Type(() => Number)
  @IsNumber()
  lat: number;

  @Type(() => Number)
  @IsNumber()
  lng: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  radius_km?: number = 50;
}
