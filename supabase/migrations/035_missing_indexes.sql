-- Migration 035: Add missing indexes for frequently queried columns

-- notifications: filter unread (read_at IS NULL)
CREATE INDEX idx_notifications_read_at ON notifications(read_at)
  WHERE read_at IS NULL;

-- push_tokens: lookup/deduplicate by token value
CREATE INDEX idx_push_tokens_token ON push_tokens(token);

-- trail_reviews: duplicate-check by (user_id, trail_id)
CREATE INDEX idx_trail_reviews_user_trail ON trail_reviews(user_id, trail_id);

-- checkpoint_completions: duplicate-check by (user_id, checkpoint_id)
CREATE INDEX idx_checkpoint_completions_user_cp
  ON checkpoint_completions(user_id, checkpoint_id);

-- profiles: username search (trigram would be ideal, but btree covers exact + prefix)
CREATE INDEX idx_profiles_username ON profiles(username);
