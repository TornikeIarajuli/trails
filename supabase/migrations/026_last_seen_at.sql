-- Migration 026: Track user online presence via last_seen_at timestamp.
-- The mobile app sends a heartbeat every 30s when in foreground.
-- "Online" is defined client-side as last_seen_at within the last 3 minutes.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
