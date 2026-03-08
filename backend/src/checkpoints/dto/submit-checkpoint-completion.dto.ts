import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class SubmitCheckpointCompletionDto {
  @IsString()
  @IsNotEmpty()
  checkpoint_id: string;

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
