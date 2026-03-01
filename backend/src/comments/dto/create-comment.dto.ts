import { IsString, IsNotEmpty, IsIn, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  activity_id: string;

  @IsIn(['completion', 'photo', 'condition', 'review'])
  activity_type: 'completion' | 'photo' | 'condition' | 'review';

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  comment: string;
}
