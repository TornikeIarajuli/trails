export class CreateCommentDto {
  activity_id: string;
  activity_type: 'completion' | 'photo' | 'condition' | 'review';
  comment: string;
}
