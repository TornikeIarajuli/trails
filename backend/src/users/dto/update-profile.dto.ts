import { IsOptional, IsString, MaxLength } from 'class-validator';

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
}
