-- Migration 065: XP, for levels and the weekly leaderboard.
--
-- XP is counted from what people already do, so there is nothing new to store:
--
--   hike recorded in the app   100 + 10 per km + 1 per 10 m climbed (the trail's distance and
--                              ascent); once per trail per day; not for "hikes" under 5 minutes
--   trail marked as done       20 (hiked before the app, not verified)
--   photo                      5, up to 10 per trail
--   review                     20
--   condition report           15, once per trail per day
--   post                       10, up to 3 a day
--   badge                      50
--   group hike organised       30
--
-- Days are Georgian days (Asia/Tbilisi).
--
--   xp_events(p_since)                          every XP-earning event since then
--   get_xp_leaderboard(p_since, p_limit)        the top hikers by XP since then, with rank
--   get_user_xp(p_user_id, p_week_start, p_month_start)
--                                               one hiker's XP all time, this week and this
--                                               month, and their rank in each (null when 0)
--
-- Plain SQL functions (checked when created), security invoker, service role only.

begin;

create or replace function public.xp_events(p_since timestamptz default '-infinity')
returns table (user_id uuid, xp integer, earned_at timestamptz, source text)
language sql
stable
set search_path = public, pg_temp
as $$
  select c.user_id,
         (100 + coalesce(round(t.distance_km * 10), 0) + coalesce(t.elevation_gain_m / 10, 0))::integer,
         c.completed_at,
         'hike'
  from (
    select distinct on (tc.user_id, tc.trail_id, (tc.completed_at at time zone 'Asia/Tbilisi')::date)
      tc.user_id, tc.trail_id, tc.completed_at
    from trail_completions tc
    where tc.status = 'approved'
      and tc.source <> 'past'
      and coalesce(tc.elapsed_seconds, 300) >= 300
      and tc.completed_at >= p_since
    order by tc.user_id, tc.trail_id, (tc.completed_at at time zone 'Asia/Tbilisi')::date, tc.completed_at
  ) c
  join trails t on t.id = c.trail_id

  union all

  select tc.user_id, 20, tc.completed_at, 'past'
  from trail_completions tc
  where tc.status = 'approved' and tc.source = 'past' and tc.completed_at >= p_since

  union all

  select ph.user_id, 5, ph.taken_at, 'photo'
  from (
    select tp.user_id, tp.taken_at,
           row_number() over (partition by tp.user_id, tp.trail_id order by tp.taken_at, tp.id) as n
    from trail_photos tp
  ) ph
  where ph.n <= 10 and ph.taken_at >= p_since

  union all

  select tr.user_id, 20, tr.created_at, 'review'
  from trail_reviews tr
  where tr.created_at >= p_since

  union all

  select co.user_id, 15, co.reported_at, 'condition'
  from (
    select distinct on (tco.user_id, tco.trail_id, (tco.reported_at at time zone 'Asia/Tbilisi')::date)
      tco.user_id, tco.reported_at
    from trail_conditions tco
    where tco.reported_at >= p_since
    order by tco.user_id, tco.trail_id, (tco.reported_at at time zone 'Asia/Tbilisi')::date, tco.reported_at
  ) co

  union all

  select po.user_id, 10, po.created_at, 'post'
  from (
    select ps.user_id, ps.created_at,
           row_number() over (
             partition by ps.user_id, (ps.created_at at time zone 'Asia/Tbilisi')::date
             order by ps.created_at, ps.id
           ) as n
    from posts ps
  ) po
  where po.n <= 3 and po.created_at >= p_since

  union all

  select ub.user_id, 50, ub.earned_at, 'badge'
  from user_badges ub
  where ub.earned_at >= p_since

  union all

  select e.organizer_id, 30, e.created_at, 'group_hike'
  from events e
  where e.created_at >= p_since
$$;

create or replace function public.get_xp_leaderboard(
  p_since timestamptz,
  p_limit integer default 50
)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  xp bigint,
  rank bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  select p.id, p.username, p.full_name, p.avatar_url, t.xp, rank() over (order by t.xp desc)
  from (
    select ev.user_id, sum(ev.xp)::bigint as xp
    from xp_events(p_since) ev
    group by ev.user_id
  ) t
  join profiles p on p.id = t.user_id
  where t.xp > 0
  order by t.xp desc, p.username
  limit p_limit
$$;

create or replace function public.get_user_xp(
  p_user_id uuid,
  p_week_start timestamptz,
  p_month_start timestamptz
)
returns table (
  total_xp bigint,
  week_xp bigint,
  month_xp bigint,
  total_rank bigint,
  week_rank bigint,
  month_rank bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  with per_user as (
    select ev.user_id,
           sum(ev.xp)::bigint as total,
           coalesce(sum(ev.xp) filter (where ev.earned_at >= p_week_start), 0)::bigint as week,
           coalesce(sum(ev.xp) filter (where ev.earned_at >= p_month_start), 0)::bigint as month
    from xp_events() ev
    group by ev.user_id
  ),
  me as (
    select coalesce(pu.total, 0) as total, coalesce(pu.week, 0) as week, coalesce(pu.month, 0) as month
    from (select p_user_id as id) u
    left join per_user pu on pu.user_id = u.id
  )
  select
    me.total,
    me.week,
    me.month,
    case when me.total > 0 then 1 + (select count(*) from per_user where total > me.total) end,
    case when me.week > 0 then 1 + (select count(*) from per_user where week > me.week) end,
    case when me.month > 0 then 1 + (select count(*) from per_user where month > me.month) end
  from me
$$;

revoke all on function public.xp_events(timestamptz) from public, anon, authenticated;
revoke all on function public.get_xp_leaderboard(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.get_user_xp(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.xp_events(timestamptz) to service_role;
grant execute on function public.get_xp_leaderboard(timestamptz, integer) to service_role;
grant execute on function public.get_user_xp(uuid, timestamptz, timestamptz) to service_role;

insert into public.schema_migrations (version, description)
values ('065', 'xp')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
