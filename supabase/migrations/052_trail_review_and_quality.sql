-- Migration 052: Keeping the trail catalogue correct.
--
-- 1. Review state per trail. Routes, distances and elevations come from OpenStreetMap and a
--    terrain model; nobody can guarantee them without looking. `reviewed_at` is set when an
--    admin has checked the trail in the admin panel (the app labels unreviewed trails), and
--    `review_flags` carries the content pipeline's reasons to look first (for example
--    'manual_review', 'generated_name', 'near_border').
-- 2. Hikers can report a problem with a trail itself (wrong route, path gone, wrong info).
-- 3. trail_hike_quality(): recorded hikes compared with each trail's route and estimates, so
--    trails whose hikers keep leaving the line, fail verification, or walk much longer or
--    shorter than estimated can be found and corrected.

begin;

alter table public.trails
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_notes text,
  add column if not exists review_flags text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'trails_review_notes_length' and conrelid = 'public.trails'::regclass
  ) then
    alter table public.trails
      add constraint trails_review_notes_length
      check (review_notes is null or char_length(review_notes) <= 2000);
  end if;
end $$;

-- Reports about a trail itself.
alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add constraint content_reports_target_type_check
  check (target_type in ('photo', 'comment', 'review', 'condition', 'event', 'user', 'completion', 'trail'));

alter table public.content_reports drop constraint if exists content_reports_reason_check;
alter table public.content_reports add constraint content_reports_reason_check
  check (reason in ('spam', 'offensive', 'harassment', 'dangerous', 'other',
                    'wrong_route', 'path_missing', 'wrong_info'));

-- Recorded hikes against each trail. `off_route` is the share of a hike's track that is more
-- than 120 m from the trail's route: when most hikers are mostly off the line, the line is
-- probably wrong.
create or replace function public.trail_hike_quality(p_min_hikes int default 1)
returns table (
  trail_id uuid,
  name_en text,
  hikes int,
  verified int,
  median_coverage numeric,
  median_off_route numeric,
  median_hours numeric,
  estimated_hours numeric,
  median_distance_km numeric,
  distance_km numeric,
  last_hike timestamptz
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with h as (
    select
      hk.trail_id,
      hk.verified,
      hk.coverage,
      hk.elapsed_seconds,
      hk.distance_m,
      hk.completed_at,
      case
        when hk.track is not null and t.route is not null
             and st_length(hk.track::geography) > 0
        then least(1, greatest(0,
          st_length(st_difference(hk.track, st_buffer(t.route::geography, 120)::geometry)::geography)
          / st_length(hk.track::geography)))
      end as off_route
    from hikes hk
    join trails t on t.id = hk.trail_id
  )
  select
    t.id,
    t.name_en,
    count(*)::int,
    (count(*) filter (where h.verified))::int,
    round((percentile_cont(0.5) within group (order by h.coverage))::numeric, 3),
    round((percentile_cont(0.5) within group (order by h.off_route))::numeric, 3),
    round((percentile_cont(0.5) within group (order by h.elapsed_seconds) / 3600.0)::numeric, 2),
    t.estimated_hours,
    round((percentile_cont(0.5) within group (order by h.distance_m) / 1000.0)::numeric, 2),
    t.distance_km,
    max(h.completed_at)
  from trails t
  join h on h.trail_id = t.id
  group by t.id
  having count(*) >= greatest(coalesce(p_min_hikes, 1), 1)
  order by count(*) desc;
$$;

revoke all on function public.trail_hike_quality(int) from public, anon, authenticated;
grant execute on function public.trail_hike_quality(int) to service_role;

insert into public.schema_migrations (version, description)
values ('052', 'trail_review_and_quality')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
