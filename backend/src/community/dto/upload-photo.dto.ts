import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UploadPhotoDto {
  @IsString()
  @IsNotEmpty()
  trail_id: string;

  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  caption?: string;
}
