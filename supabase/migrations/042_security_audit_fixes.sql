-- Migration 042: Security audit fixes
-- Addresses findings from code-level security audit

-- ============================================
-- Fix #1: Admin role check — move from user_metadata to app_metadata
-- user_metadata (raw_user_meta_data) is user-controllable at signup.
-- app_metadata (raw_app_meta_data) is only settable by service role.
-- ============================================

-- Move existing admin role to app_metadata for the admin user
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE raw_user_meta_data->>'role' = 'admin';

-- Update RLS policies on trails to use raw_app_meta_data
DROP POLICY IF EXISTS "Admins can manage trails" ON trails;
CREATE POLICY "Admins can manage trails"
    ON trails FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_app_meta_data->>'role' = 'admin'
        )
    );

-- Update RLS policies on trail_media to use raw_app_meta_data
DROP POLICY IF EXISTS "Admins can manage trail media" ON trail_media;
CREATE POLICY "Admins can manage trail media"
    ON trail_media FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_app_meta_data->>'role' = 'admin'
        )
    );

-- Update RLS policies on trail_checkpoints to use raw_app_meta_data
DROP POLICY IF EXISTS "Admins can manage checkpoints" ON trail_checkpoints;
CREATE POLICY "Admins can manage checkpoints"
    ON trail_checkpoints FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_app_meta_data->>'role' = 'admin'
        )
    );

-- ============================================
-- Fix #6: Like RPCs — validate caller is the user
-- Prevents users from liking/unliking on behalf of others
-- ============================================

CREATE OR REPLACE FUNCTION toggle_photo_like(p_photo_id UUID, p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_exists BOOLEAN;
    v_new_count INT;
BEGIN
    -- Verify the caller is the user (prevent acting on behalf of others)
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Cannot perform actions on behalf of another user';
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM photo_likes WHERE photo_id = p_photo_id AND user_id = p_user_id
    ) INTO v_exists;

    IF v_exists THEN
        DELETE FROM photo_likes WHERE photo_id = p_photo_id AND user_id = p_user_id;
        UPDATE trail_photos SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = p_photo_id;
    ELSE
        INSERT INTO photo_likes (photo_id, user_id) VALUES (p_photo_id, p_user_id);
        UPDATE trail_photos SET likes_count = likes_count + 1 WHERE id = p_photo_id;
    END IF;

    SELECT likes_count INTO v_new_count FROM trail_photos WHERE id = p_photo_id;

    RETURN json_build_object('liked', NOT v_exists, 'likes_count', v_new_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION toggle_activity_like_full(
  p_activity_id TEXT,
  p_activity_type TEXT,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_exists BOOLEAN;
  v_count INT;
BEGIN
  -- Verify the caller is the user
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot perform actions on behalf of another user';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM activity_likes
    WHERE activity_id = p_activity_id AND user_id = p_user_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM activity_likes WHERE activity_id = p_activity_id AND user_id = p_user_id;
  ELSE
    INSERT INTO activity_likes (activity_id, activity_type, user_id)
    VALUES (p_activity_id, p_activity_type, p_user_id)
    ON CONFLICT (activity_id, user_id) DO NOTHING;
  END IF;

  SELECT COUNT(*) INTO v_count FROM activity_likes WHERE activity_id = p_activity_id;
  RETURN json_build_object('liked', NOT v_exists, 'count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Fix #8: Missing DELETE policies
-- ============================================

-- trail_reviews: users should be able to delete their own reviews
CREATE POLICY "Users can delete their own reviews"
    ON trail_reviews FOR DELETE
    USING (user_id = auth.uid());

-- trail_conditions: users should be able to delete their own reports
CREATE POLICY "Users can delete their own conditions"
    ON trail_conditions FOR DELETE
    USING (user_id = auth.uid());

-- checkpoint_completions: users should be able to delete their own completions
CREATE POLICY "Users can delete their own checkpoint completions"
    ON checkpoint_completions FOR DELETE
    USING (user_id = auth.uid());
