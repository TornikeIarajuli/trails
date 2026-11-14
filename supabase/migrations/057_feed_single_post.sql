-- Migration 057: One post of the activity feed.
--
-- get_activity_item returns a single activity with the same columns as get_activity_feed
-- (056), whoever posted it. The API uses it to open the post a notification is about
-- ("nino liked your hike"); no row when the activity was deleted, or when it is no longer a
-- post of its own (a photo shown under its hike's completion).
--
-- A plain SQL function, so PostgreSQL checks its result against the declared columns when it
-- is created. Security invoker (the API calls it with the service role) and callable only by
-- the service role.

begin;

create or replace function public.get_activity_item(p_activity_id uuid)
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
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select
    af.activity_id,
    af.activity_type,
    af.user_id,
    af.trail_id,
    af.created_at,
    af.extra_text,
    af.photo_url,
    af.photo_urls,
    p.username,
    p.full_name,
    p.avatar_url,
    t.name_en,
    t.name_ka,
    t.cover_image_url,
    t.distance_km,
    t.elevation_gain_m,
    tc.elapsed_seconds
  from activity_feed af
  inner join profiles p on p.id = af.user_id
  inner join trails t on t.id = af.trail_id
  left join trail_completions tc
    on af.activity_type = 'completion' and tc.id = af.activity_id
  where af.activity_id = p_activity_id
  limit 1;
$$;

revoke all on function public.get_activity_item(uuid) from public, anon, authenticated;
grant execute on function public.get_activity_item(uuid) to service_role;

insert into public.schema_migrations (version, description)
values ('057', 'feed_single_post')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
