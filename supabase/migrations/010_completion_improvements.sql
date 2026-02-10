-- Migration 010: Allow hike completions without proof photos + delete support
-- Enables "end hike → auto record" flow and user deletion of their own completions

-- Make proof_photo_url optional (hikes recorded on end don't require a photo)
ALTER TABLE trail_completions ALTER COLUMN proof_photo_url DROP NOT NULL;

-- Allow users to delete their own completions
CREATE POLICY "Users can delete their own completions"
    ON trail_completions FOR DELETE
    USING (user_id = auth.uid());

-- Decrement trail count when a completion is deleted
CREATE OR REPLACE FUNCTION decrement_trail_count(p_user_id UUID)
RETURNS VOID
LANGUAGE sql
AS $$
    UPDATE profiles
    SET total_trails_completed = GREATEST(total_trails_completed - 1, 0)
    WHERE id = p_user_id;
$$;
