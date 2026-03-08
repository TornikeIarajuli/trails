-- Migration 034: Active hikes auto-cleanup + orphan comment/like prevention

-- ============================================
-- 1. pg_cron: Clean up stale active hikes older than 24 hours
-- ============================================
SELECT cron.schedule(
  'cleanup-stale-active-hikes',
  '0 */4 * * *',  -- Every 4 hours
  $$
    DELETE FROM active_hikes
    WHERE started_at < NOW() - INTERVAL '24 hours';
  $$
);

-- ============================================
-- 2. Cleanup function for orphaned comments/likes
--    Called by triggers when parent activities are deleted
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_activity_comments_and_likes()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM activity_comments WHERE activity_id = OLD.id::TEXT;
  DELETE FROM activity_likes WHERE activity_id = OLD.id::TEXT;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. Attach triggers to all activity source tables
-- ============================================

-- Completions
CREATE TRIGGER trg_cleanup_completion_comments_likes
  AFTER DELETE ON trail_completions
  FOR EACH ROW EXECUTE FUNCTION cleanup_activity_comments_and_likes();

-- Trail photos
CREATE TRIGGER trg_cleanup_photo_comments_likes
  AFTER DELETE ON trail_photos
  FOR EACH ROW EXECUTE FUNCTION cleanup_activity_comments_and_likes();

-- Trail conditions
CREATE TRIGGER trg_cleanup_condition_comments_likes
  AFTER DELETE ON trail_conditions
  FOR EACH ROW EXECUTE FUNCTION cleanup_activity_comments_and_likes();

-- Reviews
CREATE TRIGGER trg_cleanup_review_comments_likes
  AFTER DELETE ON trail_reviews
  FOR EACH ROW EXECUTE FUNCTION cleanup_activity_comments_and_likes();

-- Events
CREATE TRIGGER trg_cleanup_event_comments_likes
  AFTER DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION cleanup_activity_comments_and_likes();
