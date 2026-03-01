-- ============================================
-- Migration 017: Activity likes
-- Note: activity_comments FK fix was handled in 015_fix_comments_fk.sql
-- ============================================
SET search_path TO public;

-- ============================================
-- Activity likes table
-- ============================================
CREATE TABLE IF NOT EXISTS activity_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id TEXT NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('completion', 'photo', 'condition', 'review')),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (activity_id, user_id)
);

CREATE INDEX IF NOT EXISTS activity_likes_activity_id_idx ON activity_likes(activity_id);
CREATE INDEX IF NOT EXISTS activity_likes_user_id_idx ON activity_likes(user_id);

ALTER TABLE activity_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes"
  ON activity_likes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert own likes"
  ON activity_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
  ON activity_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- RPC: Toggle activity like (returns liked + count)
-- ============================================
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
-- To give admin user the highest title (Legend of the Peaks),
-- run this in Supabase SQL editor with your username:
--
-- UPDATE profiles SET total_trails_completed = 100
-- WHERE username = 'YOUR_USERNAME_HERE';
--
-- ============================================
