-- Migration 041: Restrict sensitive RPC functions to service_role only
-- These functions modify user data (profile counts) and should only be
-- called by the backend (service_role), not directly via PostgREST.

REVOKE EXECUTE ON FUNCTION increment_trail_count(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION decrement_trail_count(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION check_and_award_badges(UUID) FROM anon, authenticated;

-- cleanup_activity_comments_and_likes is a trigger function, not user-callable
REVOKE EXECUTE ON FUNCTION cleanup_activity_comments_and_likes() FROM anon, authenticated;
