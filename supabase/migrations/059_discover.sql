-- Migration 059: Discover, so the feed is never empty for new users.
--
-- The Following feed only shows people you follow, so a new user's feed is empty. Discover
-- shows everyone's posts, best first, and suggests hikers to follow.
--
--   get_discover_feed(p_user_id, p_limit, p_offset)
--     Every post of the activity feed except the viewer's own and those of anyone they blocked
--     or who blocked them. Same columns as get_activity_feed (056) plus total_count (all
--     matching posts, for paging). Ranked by engagement over age, like Hacker News: likes,
--     comments, photos and finished hikes lift a post, and older posts slowly sink.
--   get_suggested_hikers(p_user_id, p_limit)
--     People the viewer does not follow yet and has no block with: first those followed by
--     people they follow (with one of them as followed_by), then the most active hikers, then
--     the most recently active.
--
-- Plain SQL functions (checked when created), security invoker, service role only.

begin;

create or replace function public.get_discover_feed(
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
  elapsed_seconds integer,
  total_count bigint
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with candidates as (
    select
      af.activity_id,
      af.activity_type,
      af.user_id,
      af.trail_id,
      af.created_at,
      af.extra_text,
      af.photo_url,
      af.photo_urls,
      (select count(*) from activity_likes l where l.activity_id = af.activity_id::text) as likes,
      (select count(*) from activity_comments c where c.activity_id = af.activity_id::text) as comments
    from activity_feed af
    inner join profiles p on p.id = af.user_id
    inner join trails t on t.id = af.trail_id
    where af.user_id <> p_user_id
      and not exists (
        select 1 from user_blocks b
        where (b.blocker_id = p_user_id and b.blocked_id = af.user_id)
           or (b.blocker_id = af.user_id and b.blocked_id = p_user_id)
      )
  ),
  ranked as (
    select
      c.*,
      (
        1
        + c.likes
        + 2 * c.comments
        + case when c.photo_url is not null or c.photo_urls is not null then 2 else 0 end
        + case when c.activity_type = 'completion' then 1 else 0 end
      )::numeric
        / power(greatest(extract(epoch from (now() - c.created_at)), 0) / 3600 + 2, 1.2) as score,
      count(*) over () as total_count
    from candidates c
  )
  select
    r.activity_id,
    r.activity_type,
    r.user_id,
    r.trail_id,
    r.created_at,
    r.extra_text,
    r.photo_url,
    r.photo_urls,
    p.username,
    p.full_name,
    p.avatar_url,
    t.name_en,
    t.name_ka,
    t.cover_image_url,
    t.distance_km,
    t.elevation_gain_m,
    tc.elapsed_seconds,
    r.total_count
  from ranked r
  inner join profiles p on p.id = r.user_id
  inner join trails t on t.id = r.trail_id
  left join trail_completions tc
    on r.activity_type = 'completion' and tc.id = r.activity_id
  order by r.score desc, r.created_at desc, r.activity_id
  limit p_limit
  offset p_offset;
$$;

create or replace function public.get_suggested_hikers(
  p_user_id uuid,
  p_limit integer default 10
)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  total_trails_completed integer,
  followed_by text,
  mutual_count bigint
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.total_trails_completed,
    (
      select fp.username
      from user_follows mine
      inner join user_follows theirs
        on theirs.follower_id = mine.following_id and theirs.following_id = p.id
      inner join profiles fp on fp.id = mine.following_id
      where mine.follower_id = p_user_id
      order by fp.username
      limit 1
    ) as followed_by,
    (
      select count(*)
      from user_follows mine
      inner join user_follows theirs
        on theirs.follower_id = mine.following_id and theirs.following_id = p.id
      where mine.follower_id = p_user_id
    ) as mutual_count
  from profiles p
  where p.id <> p_user_id
    and not exists (
      select 1 from user_follows f
      where f.follower_id = p_user_id and f.following_id = p.id
    )
    and not exists (
      select 1 from user_blocks b
      where (b.blocker_id = p_user_id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = p_user_id)
    )
  order by
    mutual_count desc,
    p.total_trails_completed desc,
    (select count(*) from activity_feed af where af.user_id = p.id) desc,
    p.last_seen_at desc nulls last,
    p.created_at desc
  limit p_limit;
$$;

revoke all on function public.get_discover_feed(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.get_discover_feed(uuid, integer, integer) to service_role;
revoke all on function public.get_suggested_hikers(uuid, integer) from public, anon, authenticated;
grant execute on function public.get_suggested_hikers(uuid, integer) to service_role;

insert into public.schema_migrations (version, description)
values ('059', 'discover')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
