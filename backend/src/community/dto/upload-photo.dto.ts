import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsLooseUuid } from '../../common/validators/is-loose-uuid';
import { IsStorageUrl } from '../../common/validators/is-storage-url';

export class UploadPhotoDto {
  @IsLooseUuid()
  trail_id: string;

  @IsStorageUrl()
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  caption?: string;
}
