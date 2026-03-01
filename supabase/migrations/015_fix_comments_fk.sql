-- Fix activity_comments FK: point user_id at profiles instead of auth.users
-- so PostgREST can automatically join to the profiles table.
-- profiles.id already references auth.users(id), so cascade deletes still work.

ALTER TABLE activity_comments
  DROP CONSTRAINT activity_comments_user_id_fkey;

ALTER TABLE activity_comments
  ADD CONSTRAINT activity_comments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
