-- Migration 036: Re-point trail_bookmarks.user_id FK from auth.users to profiles
-- Matches the fix applied to trail_conditions/trail_photos in migration 008.

ALTER TABLE trail_bookmarks
    DROP CONSTRAINT trail_bookmarks_user_id_fkey,
    ADD CONSTRAINT trail_bookmarks_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
