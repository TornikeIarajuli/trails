-- Allow 'event' as a valid activity_type in activity_comments
ALTER TABLE activity_comments DROP CONSTRAINT IF EXISTS activity_comments_activity_type_check;
ALTER TABLE activity_comments ADD CONSTRAINT activity_comments_activity_type_check
  CHECK (activity_type IN ('completion', 'photo', 'condition', 'review', 'event'));
