import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewCompletionDto {
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewer_note?: string;
}
