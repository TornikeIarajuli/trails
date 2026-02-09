import { IsUUID, IsString, IsOptional } from 'class-validator';

export class UploadPhotoDto {
  @IsUUID()
  trail_id: string;

  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  caption?: string;
}
