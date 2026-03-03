-- Migration 020: Active hikes table (hiker count / congestion)

CREATE TABLE active_hikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(trail_id, user_id)
);

-- RLS
ALTER TABLE active_hikes ENABLE ROW LEVEL SECURITY;

-- Anyone can read (for congestion display)
CREATE POLICY "active_hikes_select" ON active_hikes
  FOR SELECT USING (true);

-- Users can only insert their own row
CREATE POLICY "active_hikes_insert" ON active_hikes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own row
CREATE POLICY "active_hikes_delete" ON active_hikes
  FOR DELETE USING (auth.uid() = user_id);

-- Auto-cleanup: remove stale hikes older than 24h (run via pg_cron or manual cleanup)
CREATE INDEX active_hikes_trail_id_idx ON active_hikes(trail_id);
CREATE INDEX active_hikes_started_at_idx ON active_hikes(started_at);
