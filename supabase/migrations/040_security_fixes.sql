-- Migration 040: Fix Supabase security linter warnings
-- 1. activity_feed view: change from SECURITY DEFINER to SECURITY INVOKER
-- 2. schema_migrations: enable RLS (system table, no policies needed)
-- Fix: spatial_ref_sys is owned by supabase_admin so we can't enable RLS,
-- but we can revoke access from the API roles to hide it from PostgREST
REVOKE ALL ON public.spatial_ref_sys FROM anon, authenticated;

-- Fix: Security Definer View on activity_feed
ALTER VIEW activity_feed SET (security_invoker = on);

-- Fix: RLS Disabled on schema_migrations
ALTER TABLE IF EXISTS public.schema_migrations ENABLE ROW LEVEL SECURITY;
