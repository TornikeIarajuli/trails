-- Migration 028: Schema migration tracking table.
-- Records which migrations have been applied to this database.
-- Going forward, append an INSERT at the end of each new migration file.

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

-- Mark all previously applied migrations as done
INSERT INTO schema_migrations (version, description) VALUES
  ('001', 'initial_schema'),
  ('002', 'rpc_functions'),
  ('003', 'storage_buckets'),
  ('004', 'checkpoints'),
  ('005', 'checkpoint_rpc'),
  ('006', 'admin_role'),
  ('007', 'new_features'),
  ('008', 'fix_community_fkeys'),
  ('009', 'follows_and_feed'),
  ('010', 'completion_improvements'),
  ('011', 'hike_duration'),
  ('012', 'push_tokens'),
  ('013', 'products'),
  ('014', 'activity_comments'),
  ('015', 'fix_comments_fk'),
  ('016', 'more_badges'),
  ('017', 'likes_and_fixes'),
  ('018', 'rls_update_policies'),
  ('019', 'trail_status'),
  ('020', 'active_hikes'),
  ('021', 'notification_center'),
  ('022', 'events'),
  ('023', 'emergency_contacts'),
  ('024', 'feed_include_own_activity'),
  ('025', 'feed_hike_photos'),
  ('026', 'last_seen_at'),
  ('027', 'feed_group_hike_photos'),
  ('028', 'schema_migrations')
ON CONFLICT (version) DO NOTHING;
