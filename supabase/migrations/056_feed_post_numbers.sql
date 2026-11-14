-- Migration 056: The numbers under feed posts come with the feed.
--
-- get_activity_feed also returns the trail's distance and ascent, and for a completion the
-- hiker's time, so the app no longer downloads the whole trail list to show them.
--
--   trail_distance_km       trails.distance_km
--   trail_elevation_gain_m  trails.elevation_gain_m
--   elapsed_seconds         trail_completions.elapsed_seconds (null for other kinds of post)
--
-- The result type changes, so the function is dropped and created again in one transaction,
-- with the same settings as before: security definer, a fixed search_path, and callable only
-- by the API's service role.

begin;

drop function if exists public.get_activity_feed(uuid, integer, integer);

create function public.get_activity_feed(
  p_user_id uuid,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  activity_id uuid,
  activity_type text,
  user_id uuid,
  trail_id uuid,
  created_at timestamptz,
  extra_text text,
  photo_url text,
  photo_urls jsonb,
  user_username text,
  user_full_name text,
  user_avatar_url text,
  trail_name_en text,
  trail_name_ka text,
  trail_cover_image_url text,
  trail_distance_km numeric,
  trail_elevation_gain_m integer,
  elapsed_seconds integer
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  return query
  select
    af.activity_id,
    af.activity_type,
    af.user_id,
    af.trail_id,
    af.created_at,
    af.extra_text,
    af.photo_url,
    af.photo_urls,
    p.username as user_username,
    p.full_name as user_full_name,
    p.avatar_url as user_avatar_url,
    t.name_en as trail_name_en,
    t.name_ka as trail_name_ka,
    t.cover_image_url as trail_cover_image_url,
    t.distance_km as trail_distance_km,
    t.elevation_gain_m as trail_elevation_gain_m,
    tc.elapsed_seconds
  from activity_feed af
  inner join profiles p on p.id = af.user_id
  inner join trails t on t.id = af.trail_id
  left join trail_completions tc
    on af.activity_type = 'completion' and tc.id = af.activity_id
  where af.user_id = p_user_id
     or exists (
       select 1 from user_follows uf
       where uf.follower_id = p_user_id and uf.following_id = af.user_id
     )
  order by af.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.get_activity_feed(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.get_activity_feed(uuid, integer, integer) to service_role;

-- PL/pgSQL checks a query against the declared result only when it runs: run it once here, so
-- a mismatch fails the migration (and changes nothing) instead of breaking the feed.
do $$
begin
  perform * from public.get_activity_feed(
    (select id from public.profiles order by created_at limit 1), 50, 0
  );
end $$;

insert into public.schema_migrations (version, description)
values ('056', 'feed_post_numbers')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
