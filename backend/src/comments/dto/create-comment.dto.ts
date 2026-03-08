import { IsString, IsNotEmpty, IsIn, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  activity_id: string;

  @IsIn(['completion', 'photo', 'condition', 'review', 'event'])
  activity_type: 'completion' | 'photo' | 'condition' | 'review' | 'event';

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  comment: string;
}
