-- pg_cron must exist before cron.schedule() can be called. It is already enabled on the
-- hosted project; this line makes the migration replayable on a fresh database.
create extension if not exists pg_cron with schema pg_catalog;

-- Auto-deactivate trail conditions older than 14 days via pg_cron
-- Runs daily at 3:00 AM UTC
SELECT cron.schedule(
  'expire-old-trail-conditions',
  '0 3 * * *',
  $$
    UPDATE trail_conditions
    SET is_active = false
    WHERE is_active = true
      AND reported_at < NOW() - INTERVAL '14 days';
  $$
);
