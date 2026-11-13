import { IsString, IsNotEmpty, IsIn, MaxLength } from 'class-validator';
import { IsLooseUuid } from '../../common/validators/is-loose-uuid';

export class CreateCommentDto {
  @IsLooseUuid()
  activity_id: string;

  @IsIn(['completion', 'photo', 'condition', 'review', 'event'])
  activity_type: 'completion' | 'photo' | 'condition' | 'review' | 'event';

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  comment: string;
}
