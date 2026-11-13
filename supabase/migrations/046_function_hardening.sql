-- Migration 046: Function fixes.
--   * SECURITY DEFINER functions get a fixed search_path.
--   * The like RPCs' "caller is the user" check added in 042 compared with `!=`, which is
--     NULL (not true) when auth.uid() is NULL, so it never fired for key-only callers.
--     They are also made safe against concurrent toggles.
--   * increment/decrement_trail_count become an absolute recount, so the counter cannot
--     drift whichever caller uses them (see 047 for the trigger that makes them redundant).
--   * handle_new_user no longer trusts the username in signup metadata blindly.
--   * find_nearby_trails also returns start_point and status, which the app's map needs.

begin;

-- 1. Fixed search_path for every SECURITY DEFINER function we own (PostGIS lives in public).
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and pg_get_userbyid(p.proowner) = current_user
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', r.sig);
  end loop;
end $$;

-- 2. Like RPCs.
create or replace function public.toggle_photo_like(p_photo_id uuid, p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_deleted int;
  v_count int;
begin
  -- A signed-in caller may only act as themselves; the service role (no auth.uid()) may act
  -- for any user because the API has already authenticated them.
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    raise exception 'Cannot perform actions on behalf of another user';
  end if;

  delete from photo_likes where photo_id = p_photo_id and user_id = p_user_id;
  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    insert into photo_likes (photo_id, user_id) values (p_photo_id, p_user_id)
    on conflict (photo_id, user_id) do nothing;
  end if;

  update trail_photos
  set likes_count = (select count(*) from photo_likes where photo_id = p_photo_id)
  where id = p_photo_id
  returning likes_count into v_count;

  return json_build_object('liked', v_deleted = 0, 'likes_count', coalesce(v_count, 0));
end;
$$;

create or replace function public.toggle_activity_like_full(
  p_activity_id text,
  p_activity_type text,
  p_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_deleted int;
  v_count int;
begin
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    raise exception 'Cannot perform actions on behalf of another user';
  end if;

  delete from activity_likes where activity_id = p_activity_id and user_id = p_user_id;
  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    insert into activity_likes (activity_id, activity_type, user_id)
    values (p_activity_id, p_activity_type, p_user_id)
    on conflict (activity_id, user_id) do nothing;
  end if;

  select count(*) into v_count from activity_likes where activity_id = p_activity_id;
  return json_build_object('liked', v_deleted = 0, 'count', v_count);
end;
$$;

-- 3. The completion counter is derived data: always recompute it.
create or replace function public.increment_trail_count(p_user_id uuid)
returns void
language sql
set search_path = public, pg_temp
as $$
  update profiles p
  set total_trails_completed = (
    select count(*) from trail_completions c
    where c.user_id = p_user_id and c.status = 'approved'
  )
  where p.id = p_user_id;
$$;

create or replace function public.decrement_trail_count(p_user_id uuid)
returns void
language sql
set search_path = public, pg_temp
as $$
  update profiles p
  set total_trails_completed = (
    select count(*) from trail_completions c
    where c.user_id = p_user_id and c.status = 'approved'
  )
  where p.id = p_user_id;
$$;

-- 4. New-user profile: fall back to a generated username when the metadata value is
--    missing or outside 3-30 characters, and cap the display name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_username text := nullif(btrim(new.raw_user_meta_data->>'username'), '');
begin
  if v_username is null or char_length(v_username) < 3 or char_length(v_username) > 30 then
    v_username := 'user_' || left(replace(new.id::text, '-', ''), 12);
  end if;

  insert into public.profiles (id, username, full_name)
  values (new.id, v_username, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 100));
  return new;
end;
$$;

-- 5. Nearby trails: return the trailhead and status too. The return type changes, so the
--    function has to be dropped and recreated.
drop function if exists public.find_nearby_trails(double precision, double precision, double precision);

create function public.find_nearby_trails(
  user_lat double precision,
  user_lng double precision,
  radius_m double precision default 50000
)
returns table (
  id uuid,
  name_en text,
  name_ka text,
  difficulty trail_difficulty,
  region text,
  distance_km numeric,
  elevation_gain_m int,
  estimated_hours numeric,
  cover_image_url text,
  status text,
  status_note text,
  start_point jsonb,
  distance_from_user_m double precision
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select
    t.id,
    t.name_en,
    t.name_ka,
    t.difficulty,
    t.region,
    t.distance_km,
    t.elevation_gain_m,
    t.estimated_hours,
    t.cover_image_url,
    t.status,
    t.status_note,
    st_asgeojson(t.start_point)::jsonb as start_point,
    st_distance(
      t.start_point::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
    ) as distance_from_user_m
  from trails t
  where t.is_published = true
    and t.start_point is not null
    and st_dwithin(
      t.start_point::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
      radius_m
    )
  order by distance_from_user_m asc
  limit 200;
$$;

-- Recreated/replaced functions must stay service-role only (044 changed the defaults, but
-- be explicit).
revoke all on function public.find_nearby_trails(double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.find_nearby_trails(double precision, double precision, double precision) to service_role;

insert into public.schema_migrations (version, description)
values ('046', 'function_hardening')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
