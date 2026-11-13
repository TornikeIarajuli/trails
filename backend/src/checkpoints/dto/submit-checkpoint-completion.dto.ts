import { IsISO8601, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { IsLooseUuid } from '../../common/validators/is-loose-uuid';
import { IsStorageUrl } from '../../common/validators/is-storage-url';

export class SubmitCheckpointCompletionDto {
  @IsLooseUuid()
  checkpoint_id: string;

  @IsStorageUrl()
  proof_photo_url: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  photo_lat: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  photo_lng: number;

  @IsOptional()
  @IsISO8601({ strict: true })
  completed_at?: string;
}
