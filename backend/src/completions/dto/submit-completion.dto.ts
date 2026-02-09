import { IsString, IsUUID, IsNumber, IsOptional } from 'class-validator';

export class SubmitCompletionDto {
  @IsUUID()
  trail_id: string;

  @IsString()
  proof_photo_url: string;

  @IsNumber()
  photo_lat: number;

  @IsNumber()
  photo_lng: number;

  @IsOptional()
  @IsString()
  completed_at?: string;
}
