import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IsLooseUuid } from '../../common/validators/is-loose-uuid';
import { IsStorageUrl } from '../../common/validators/is-storage-url';

export const MAX_POST_LENGTH = 2000;
export const MAX_POST_PHOTOS = 6;
export const MAX_PLACE_LENGTH = 80;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
/** An empty place name means none. */
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

/** A post: some text and/or photos, optionally a trail and a place. */
export class CreatePostDto {
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(MAX_POST_LENGTH)
  body?: string;

  @IsOptional()
  @IsLooseUuid()
  trail_id?: string;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(MAX_PLACE_LENGTH)
  place_name?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_POST_PHOTOS)
  @IsStorageUrl({ each: true })
  photo_urls?: string[];
}

/** Changes to your own post; null clears the trail or the place. */
export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(MAX_POST_LENGTH)
  body?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsLooseUuid()
  trail_id?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(MAX_PLACE_LENGTH)
  place_name?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_POST_PHOTOS)
  @IsStorageUrl({ each: true })
  photo_urls?: string[];
}
