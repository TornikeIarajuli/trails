import { IsIn } from 'class-validator';
import { IsLooseUuid } from '../../common/validators/is-loose-uuid';

export class ToggleLikeDto {
  @IsLooseUuid()
  activity_id: string;

  // Events can be commented on but not liked (activity_likes has no 'event' type).
  @IsIn(['completion', 'photo', 'condition', 'review'])
  activity_type: 'completion' | 'photo' | 'condition' | 'review';
}
