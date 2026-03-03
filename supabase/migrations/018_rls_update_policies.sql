-- ============================================
-- Migration 018: Add missing RLS UPDATE policies
-- Prevents direct DB clients from updating rows they don't own
-- ============================================
SET search_path TO public;

-- trail_completions: block UPDATE entirely at DB level
-- (status/review_note are only changed by the backend using service role)
CREATE POLICY "No direct updates on completions"
  ON trail_completions FOR UPDATE
  USING (false);

-- trail_photos: users can update their own photo captions
CREATE POLICY "Users can update own photos"
  ON trail_photos FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- activity_comments: users can update their own comments
CREATE POLICY "Users can update own comments"
  ON activity_comments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- activity_likes: no updates (toggle is handled by RPC)
CREATE POLICY "No direct updates on likes"
  ON activity_likes FOR UPDATE
  USING (false);
