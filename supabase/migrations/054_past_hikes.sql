-- Migration 054: Past hikes.
--
-- Users can mark a trail as done when they hiked it before they had the app. Such a
-- completion is self-reported and approved at once. It counts for the trail's done mark, the
-- profile's list and total, the per-region progress and badges, but not for the leaderboard,
-- and it never appears in the activity feed.
--
--   trail_completions.source           'hike' (recorded in the app), 'photo' (photo proof)
--                                      or 'past' (self-reported)
--   trail_completions.pending_hike_id  a hike recorded later on a past-marked trail that did
--                                      not verify automatically. The completion stays
--                                      approved; when an admin approves this hike the
--                                      completion becomes a normal 'hike' one.
--   profiles.ranked_trails_completed   approved completions that are not 'past'; the
--                                      leaderboard ranks by it. total_trails_completed keeps
--                                      counting every approved completion.

begin;

-- 1. Where a completion comes from. The backfill runs only when the column is created, so
--    running the migration again changes nothing.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trail_completions'
      and column_name = 'source'
  ) then
    alter table public.trail_completions
      add column source text not null default 'hike';
    update public.trail_completions
    set source = 'photo'
    where proof_photo_url is not null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'trail_completions_source_check'
      and conrelid = 'public.trail_completions'::regclass
  ) then
    alter table public.trail_completions
      add constraint trail_completions_source_check
      check (source in ('hike', 'photo', 'past'));
  end if;
end $$;

alter table public.trail_completions
  add column if not exists pending_hike_id uuid references public.hikes(id) on delete set null;

-- 2. The leaderboard's counter.
alter table public.profiles
  add column if not exists ranked_trails_completed int not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_ranked_trails_completed_non_negative'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_ranked_trails_completed_non_negative
      check (ranked_trails_completed >= 0);
  end if;
end $$;

-- 3. The trigger from 047 keeps both counters equal to the completions they count, also when
--    a completion's source changes (a past completion upgraded by a recorded hike).
create or replace function public.sync_user_trail_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
begin
  foreach v_user in array array[
    case when tg_op <> 'INSERT' then old.user_id end,
    case when tg_op <> 'DELETE' then new.user_id end
  ]
  loop
    if v_user is not null then
      update profiles p
      set total_trails_completed = c.total,
          ranked_trails_completed = c.ranked
      from (
        select
          (count(*) filter (where status = 'approved'))::int as total,
          (count(*) filter (where status = 'approved' and source <> 'past'))::int as ranked
        from trail_completions
        where user_id = v_user
      ) c
      where p.id = v_user
        and (p.total_trails_completed is distinct from c.total
          or p.ranked_trails_completed is distinct from c.ranked);
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.sync_user_trail_count() from public, anon, authenticated;

drop trigger if exists trg_sync_user_trail_count on public.trail_completions;
create trigger trg_sync_user_trail_count
  after insert or delete or update of status, user_id, source on public.trail_completions
  for each row execute function public.sync_user_trail_count();

-- One-time correction of every profile.
update public.profiles p
set total_trails_completed = c.total,
    ranked_trails_completed = c.ranked
from (
  select
    pr.id,
    (count(tc.id) filter (where tc.status = 'approved'))::int as total,
    (count(tc.id) filter (where tc.status = 'approved' and tc.source <> 'past'))::int as ranked
  from public.profiles pr
  left join public.trail_completions tc on tc.user_id = pr.id
  group by pr.id
) c
where p.id = c.id
  and (p.total_trails_completed is distinct from c.total
    or p.ranked_trails_completed is distinct from c.ranked);

-- 4. The activity feed shows no past completions. A photo is grouped under its trail's
--    completion only when that completion is itself in the feed; otherwise it stays a post
--    of its own. Same columns as 027, so dependent functions keep working.
create or replace view public.activity_feed
with (security_invoker = on)
as
select
  tc.id as activity_id,
  'completion'::text as activity_type,
  tc.user_id,
  tc.trail_id,
  tc.completed_at as created_at,
  null::text as extra_text,
  coalesce(
    (select url from trail_photos
     where user_id = tc.user_id and trail_id = tc.trail_id
     order by taken_at desc limit 1),
    tc.proof_photo_url
  ) as photo_url,
  (select jsonb_agg(url order by taken_at desc)
   from trail_photos
   where user_id = tc.user_id and trail_id = tc.trail_id
  ) as photo_urls
from trail_completions tc
where tc.status = 'approved'
  and tc.source <> 'past'

union all

select
  tp.id as activity_id,
  'photo'::text as activity_type,
  tp.user_id,
  tp.trail_id,
  tp.taken_at as created_at,
  tp.caption as extra_text,
  tp.url as photo_url,
  null::jsonb as photo_urls
from trail_photos tp
where not exists (
  select 1 from trail_completions tc
  where tc.user_id = tp.user_id
    and tc.trail_id = tp.trail_id
    and tc.status = 'approved'
    and tc.source <> 'past'
)

union all

select
  tco.id as activity_id,
  'condition'::text as activity_type,
  tco.user_id,
  tco.trail_id,
  tco.reported_at as created_at,
  tco.condition_type::text as extra_text,
  tco.photo_url as photo_url,
  null::jsonb as photo_urls
from trail_conditions tco
where tco.is_active = true

union all

select
  tr.id as activity_id,
  'review'::text as activity_type,
  tr.user_id,
  tr.trail_id,
  tr.created_at as created_at,
  tr.rating::text as extra_text,
  null::text as photo_url,
  null::jsonb as photo_urls
from trail_reviews tr;

-- 5. Badges: past hikes count like any approved completion, except for the weekly streak,
--    because their date (1 January of the year given) is not when the hike happened.
create or replace function public.check_and_award_badges(p_user_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    v_badge record;
    v_count int;
    v_qualifies boolean;
    v_new_badges uuid[] := '{}';
begin
    for v_badge in select * from badges loop
        v_qualifies := false;

        -- Skip if already earned
        if exists(select 1 from user_badges where user_id = p_user_id and badge_id = v_badge.id) then
            continue;
        end if;

        case v_badge.category
            when 'completions' then
                select count(*) into v_count
                from trail_completions
                where user_id = p_user_id and status = 'approved';
                v_qualifies := v_count >= coalesce(v_badge.threshold, 1);

            when 'difficulty' then
                select count(*) into v_count
                from trail_completions tc
                join trails t on t.id = tc.trail_id
                where tc.user_id = p_user_id
                    and tc.status = 'approved'
                    and t.difficulty = v_badge.difficulty;
                v_qualifies := v_count >= coalesce(v_badge.threshold, 1);

            when 'region' then
                select count(*) into v_count
                from trail_completions tc
                join trails t on t.id = tc.trail_id
                where tc.user_id = p_user_id
                    and tc.status = 'approved'
                    and t.region = v_badge.region;
                v_qualifies := v_count >= coalesce(v_badge.threshold, 1);

            when 'streak' then
                -- Count max consecutive ISO weeks with >= 1 completion with a real date
                declare
                    v_max_streak int := 0;
                    v_cur_streak int := 0;
                    v_prev_week text := null;
                    v_cur_week text;
                    v_prev_week_num int;
                    v_cur_week_num int;
                    v_prev_year int;
                    v_cur_year int;
                begin
                    for v_cur_week in
                        select distinct to_char(completed_at, 'IYYY-IW') as iso_week
                        from trail_completions
                        where user_id = p_user_id
                          and status = 'approved'
                          and source <> 'past'
                        order by iso_week
                    loop
                        if v_prev_week is null then
                            v_cur_streak := 1;
                        else
                            v_prev_year := split_part(v_prev_week, '-', 1)::int;
                            v_cur_year  := split_part(v_cur_week,  '-', 1)::int;
                            v_prev_week_num := split_part(v_prev_week, '-', 2)::int;
                            v_cur_week_num  := split_part(v_cur_week,  '-', 2)::int;
                            if (v_cur_year = v_prev_year and v_cur_week_num = v_prev_week_num + 1)
                               or (v_cur_year = v_prev_year + 1 and v_prev_week_num >= 52 and v_cur_week_num = 1)
                            then
                                v_cur_streak := v_cur_streak + 1;
                            else
                                v_cur_streak := 1;
                            end if;
                        end if;
                        if v_cur_streak > v_max_streak then
                            v_max_streak := v_cur_streak;
                        end if;
                        v_prev_week := v_cur_week;
                    end loop;
                    v_qualifies := v_max_streak >= coalesce(v_badge.threshold, 4);
                end;

            when 'special' then
                case v_badge.key
                    when 'photographer' then
                        select count(*) into v_count
                        from trail_photos where user_id = p_user_id;
                        v_qualifies := v_count >= coalesce(v_badge.threshold, 10);
                    when 'reporter' then
                        select count(*) into v_count
                        from trail_conditions where user_id = p_user_id;
                        v_qualifies := v_count >= coalesce(v_badge.threshold, 5);
                    when 'bookworm' then
                        select count(*) into v_count
                        from trail_bookmarks where user_id = p_user_id;
                        v_qualifies := v_count >= coalesce(v_badge.threshold, 10);
                    when 'all_rounder' then
                        select count(distinct t.region) into v_count
                        from trail_completions tc
                        join trails t on t.id = tc.trail_id
                        where tc.user_id = p_user_id and tc.status = 'approved';
                        v_qualifies := v_count >= coalesce(v_badge.threshold, 4);
                    else
                        v_qualifies := false;
                end case;
            else
                v_qualifies := false;
        end case;

        if v_qualifies then
            insert into user_badges (user_id, badge_id) values (p_user_id, v_badge.id)
            on conflict do nothing;
            v_new_badges := array_append(v_new_badges, v_badge.id);
        end if;
    end loop;

    return v_new_badges;
end;
$$;

revoke all on function public.check_and_award_badges(uuid) from public, anon, authenticated;
grant execute on function public.check_and_award_badges(uuid) to service_role;

insert into public.schema_migrations (version, description)
values ('054', 'past_hikes')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
