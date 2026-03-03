-- Migration 021: Notification center + preferences

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'new_follower'|'badge_earned'|'completion_approved'|'event_invite'|'trail_condition'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  new_follower BOOLEAN NOT NULL DEFAULT true,
  badge_earned BOOLEAN NOT NULL DEFAULT true,
  completion_approved BOOLEAN NOT NULL DEFAULT true,
  event_invite BOOLEAN NOT NULL DEFAULT true,
  trail_condition BOOLEAN NOT NULL DEFAULT true
);

-- RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- RLS for notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_prefs_own" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Index for fast per-user queries
CREATE INDEX notifications_user_id_created_at_idx ON notifications(user_id, created_at DESC);
