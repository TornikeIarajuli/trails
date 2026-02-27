-- Activity comments: users can comment on feed items (completions, photos, conditions, reviews)

CREATE TABLE activity_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id TEXT NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('completion', 'photo', 'condition', 'review')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL CHECK (char_length(comment) >= 1 AND char_length(comment) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX activity_comments_activity_id_idx ON activity_comments(activity_id);
CREATE INDEX activity_comments_user_id_idx ON activity_comments(user_id);

ALTER TABLE activity_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comments"
  ON activity_comments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert own comments"
  ON activity_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON activity_comments FOR DELETE
  USING (auth.uid() = user_id);
