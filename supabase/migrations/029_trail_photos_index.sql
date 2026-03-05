-- Migration 029: Composite index on trail_photos(user_id, trail_id)
-- The activity_feed view (migration 027) runs two subqueries per completion row
-- against trail_photos filtered by (user_id, trail_id). Without this index,
-- each subquery is a full table scan.

CREATE INDEX IF NOT EXISTS idx_trail_photos_user_trail
    ON trail_photos(user_id, trail_id);

INSERT INTO schema_migrations (version, description)
VALUES ('029', 'trail_photos_index')
ON CONFLICT (version) DO NOTHING;
