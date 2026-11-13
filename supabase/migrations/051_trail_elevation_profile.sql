-- Migration 051: Elevation profile per trail.
--
-- The app drew its elevation chart from checkpoint elevations only, so a trail with two
-- checkpoints showed a single cliff and missed the real high point. The content pipeline
-- samples a terrain model (SRTM) along every route; the profile it produces is stored here
-- as a JSON array of [distance_m, elevation_m] pairs (integers, at most ~120 points, the
-- first at distance 0 and the last at the route's length). NULL when no profile could be
-- measured; the app then hides the chart.

begin;

alter table public.trails
  add column if not exists elevation_profile jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'trails_elevation_profile_is_array' and conrelid = 'public.trails'::regclass
  ) then
    alter table public.trails
      add constraint trails_elevation_profile_is_array
      check (elevation_profile is null or jsonb_typeof(elevation_profile) = 'array');
  end if;
end $$;

insert into public.schema_migrations (version, description)
values ('051', 'trail_elevation_profile')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
