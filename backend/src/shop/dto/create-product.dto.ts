import { IsString, IsOptional, IsBoolean, IsNumber, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  price?: string;

  @IsOptional()
  @IsString()
  shop_name?: string;

  @IsOptional()
  @IsUrl()
  external_url?: string;

  @IsOptional()
  @IsBoolean()
  is_published?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sort_order?: number;
}
