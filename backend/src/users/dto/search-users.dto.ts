import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;
}
