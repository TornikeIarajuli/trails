-- Migration 044: Lock the public schema down to the service role.
--
-- The NestJS API and the admin panel are the only database clients, and both connect with
-- the service role. Nothing legitimately uses PostgREST as `anon` (API key only) or
-- `authenticated` (a user's JWT), yet those roles held full table privileges and EXECUTE on
-- every function, guarded only by RLS policies written for a client-side model the apps
-- never used. In practice:
--   * a signed-in user could update any column of their own profile, including
--     total_trails_completed, and insert completions with status = 'approved';
--   * every profile (contact_info, last_seen_at, ...) was readable with just the API key;
--   * migration 041 revoked EXECUTE from anon/authenticated but not from PUBLIC, so every
--     function, including increment_trail_count, stayed callable by everyone.
-- Rather than repairing each policy, remove those roles' access entirely. RLS stays enabled
-- as a second line of defence.

begin;

do $$
declare
  r record;
begin
  -- Tables, views and sequences owned by the migration role. Extension objects (PostGIS'
  -- spatial_ref_sys, geometry_columns, ...) belong to supabase_admin and are left alone.
  for r in
    select c.oid::regclass as rel, c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
      and pg_get_userbyid(c.relowner) = current_user
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  loop
    if r.relkind = 'S' then
      execute format('revoke all on sequence %s from public, anon, authenticated', r.rel);
      execute format('grant all on sequence %s to service_role', r.rel);
    else
      execute format('revoke all on table %s from public, anon, authenticated', r.rel);
      execute format('grant all on table %s to service_role', r.rel);
    end if;
  end loop;

  -- Functions and procedures owned by the migration role. EXECUTE is granted to PUBLIC by
  -- default in Postgres, so it has to be revoked from PUBLIC explicitly.
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_get_userbyid(p.proowner) = current_user
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on routine %s from public, anon, authenticated', r.sig);
    execute format('grant execute on routine %s to service_role', r.sig);
  end loop;

  -- Keep RLS on everywhere so a future accidental GRANT does not expose a table.
  for r in
    select c.oid::regclass as rel
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
      and pg_get_userbyid(c.relowner) = current_user
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  loop
    execute format('alter table %s enable row level security', r.rel);
  end loop;

  -- Objects created by later migrations must not be handed to the API roles again.
  execute format('alter default privileges for role %I in schema public revoke all on tables from anon, authenticated', current_user);
  execute format('alter default privileges for role %I in schema public revoke all on sequences from anon, authenticated', current_user);
  execute format('alter default privileges for role %I in schema public revoke all on functions from anon, authenticated', current_user);
  -- EXECUTE-to-PUBLIC is a global default; it cannot be removed per schema.
  execute format('alter default privileges for role %I revoke execute on functions from public', current_user);
end $$;

-- Abort the whole migration if the result is not what we intend.
do $$
declare
  bad text;
begin
  select string_agg(c.relname, ', ') into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm')
    and pg_get_userbyid(c.relowner) = current_user
    and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
    and (
      has_table_privilege('anon', c.oid, 'select, insert, update, delete')
      or has_table_privilege('authenticated', c.oid, 'select, insert, update, delete')
      or not (has_table_privilege('service_role', c.oid, 'select')
          and has_table_privilege('service_role', c.oid, 'insert')
          and has_table_privilege('service_role', c.oid, 'update')
          and has_table_privilege('service_role', c.oid, 'delete'))
    );
  if bad is not null then
    raise exception 'lock-down check failed for tables: %', bad;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ') into bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and pg_get_userbyid(p.proowner) = current_user
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and (
      has_function_privilege('anon', p.oid, 'execute')
      or has_function_privilege('authenticated', p.oid, 'execute')
      or not has_function_privilege('service_role', p.oid, 'execute')
    );
  if bad is not null then
    raise exception 'lock-down check failed for functions: %', bad;
  end if;
end $$;

-- The hand-maintained tracking table stopped being updated after 030.
insert into public.schema_migrations (version, description) values
  ('031', 'contact_info'),
  ('032', 'event_comments'),
  ('033', 'conditions_auto_expire'),
  ('034', 'active_hikes_cleanup_and_orphan_fix'),
  ('035', 'missing_indexes'),
  ('036', 'fix_bookmarks_fkey'),
  ('037', 'get_distinct_regions'),
  ('038', 'check_constraints'),
  ('039', 'events_update_policy'),
  ('040', 'security_fixes'),
  ('041', 'rpc_permissions'),
  ('042', 'security_audit_fixes'),
  ('043', 'bookmark_categories'),
  ('044', 'lock_down_api_roles')
on conflict (version) do nothing;

commit;
