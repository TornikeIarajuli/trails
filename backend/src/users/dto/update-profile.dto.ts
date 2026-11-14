import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { INSTAGRAM_HANDLE, normalizeInstagramHandle } from '../instagram';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  full_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  // profiles.contact_info has a CHECK (char_length <= 100)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact_info?: string | null;

  // "@name", "name" or an instagram.com link become "name"; empty or null removes it
  @Transform(({ value }) => normalizeInstagramHandle(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @Matches(INSTAGRAM_HANDLE, {
    message:
      'instagram_handle must be an Instagram username: up to 30 letters, numbers, dots or underscores',
  })
  instagram_handle?: string | null;
}
