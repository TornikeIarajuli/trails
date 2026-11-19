-- Migration 064: Free-form posts.
--
-- Besides hikes, photos, condition reports and reviews, anyone can write a post: some text,
-- up to six photos, optionally a trail and a place name ("Ushguli"). Posts appear in the feed,
-- Discover and saved posts like every other post, with likes, comments, saving and reporting.
--
--   posts (id, user_id, body, trail_id, place_name, photo_urls, created_at, updated_at)
--     Only the API (service role) reads and writes it. A post needs some text or a photo.
--     Deleting the trail keeps the post (trail_id set to null).
--   activity_feed
--     Gains the posts ('post'), and a place_name column at the end (null for other kinds).
--   get_activity_feed, get_activity_item, get_discover_feed, get_saved_posts
--     Return place_name as their last column, and keep posts without a trail (left join on
--     trails, so the trail columns are null for those). The result type changes, so each is
--     dropped and created again, with the same settings: service role only.
--   activity_likes, activity_comments, content_reports
--     Accept 'post'.

begin;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  trail_id uuid references public.trails(id) on delete set null,
  place_name text check (place_name is null or char_length(place_name) between 1 and 80),
  photo_urls jsonb not null default '[]'::jsonb
    check (jsonb_typeof(photo_urls) = 'array' and jsonb_array_length(photo_urls) <= 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_not_empty check (char_length(btrim(body)) > 0 or jsonb_array_length(photo_urls) > 0)
);

create index if not exists posts_user_created_idx on public.posts (user_id, created_at desc);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_trail_idx on public.posts (trail_id) where trail_id is not null;

alter table public.posts enable row level security;
revoke all on public.posts from public, anon, authenticated;

-- Likes, comments and reports on posts
alter table public.activity_likes drop constraint if exists activity_likes_activity_type_check;
alter table public.activity_likes add constraint activity_likes_activity_type_check
  check (activity_type in ('completion', 'photo', 'condition', 'review', 'post'));

alter table public.activity_comments drop constraint if exists activity_comments_activity_type_check;
alter table public.activity_comments add constraint activity_comments_activity_type_check
  check (activity_type in ('completion', 'photo', 'condition', 'review', 'event', 'post'));

alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add constraint content_reports_target_type_check
  check (target_type in ('photo', 'comment', 'review', 'condition', 'event', 'user', 'completion', 'trail', 'post'));

-- The feed: the four kinds of 054 as they were, plus posts, plus place_name at the end
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
  ) as photo_urls,
  null::text as place_name
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
  null::jsonb as photo_urls,
  null::text as place_name
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
  null::jsonb as photo_urls,
  null::text as place_name
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
  null::jsonb as photo_urls,
  null::text as place_name
from trail_reviews tr

union all

select
  ps.id as activity_id,
  'post'::text as activity_type,
  ps.user_id,
  ps.trail_id,
  ps.created_at as created_at,
  ps.body as extra_text,
  ps.photo_urls ->> 0 as photo_url,
  case when jsonb_array_length(ps.photo_urls) > 0 then ps.photo_urls end as photo_urls,
  ps.place_name
from posts ps;

-- Following feed (056), with posts without a trail and place_name
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
  elapsed_seconds integer,
  place_name text
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
    tc.elapsed_seconds,
    af.place_name
  from activity_feed af
  inner join profiles p on p.id = af.user_id
  left join trails t on t.id = af.trail_id
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

-- One post (057)
drop function if exists public.get_activity_item(uuid);

create function public.get_activity_item(p_activity_id uuid)
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
  place_name text
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
    tc.elapsed_seconds,
    af.place_name
  from activity_feed af
  inner join profiles p on p.id = af.user_id
  left join trails t on t.id = af.trail_id
  left join trail_completions tc
    on af.activity_type = 'completion' and tc.id = af.activity_id
  where af.activity_id = p_activity_id
  limit 1;
$$;

revoke all on function public.get_activity_item(uuid) from public, anon, authenticated;
grant execute on function public.get_activity_item(uuid) to service_role;

-- Discover (059): same ranking; a post with photos counts like any post with photos
drop function if exists public.get_discover_feed(uuid, integer, integer);

create function public.get_discover_feed(
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
  total_count bigint,
  place_name text
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
      af.place_name,
      (select count(*) from activity_likes l where l.activity_id = af.activity_id::text) as likes,
      (select count(*) from activity_comments c where c.activity_id = af.activity_id::text) as comments
    from activity_feed af
    inner join profiles p on p.id = af.user_id
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
    r.total_count,
    r.place_name
  from ranked r
  inner join profiles p on p.id = r.user_id
  left join trails t on t.id = r.trail_id
  left join trail_completions tc
    on r.activity_type = 'completion' and tc.id = r.activity_id
  order by r.score desc, r.created_at desc, r.activity_id
  limit p_limit
  offset p_offset;
$$;

revoke all on function public.get_discover_feed(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.get_discover_feed(uuid, integer, integer) to service_role;

-- Saved posts (063)
drop function if exists public.get_saved_posts(uuid, integer, integer);

create function public.get_saved_posts(
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
  saved_at timestamptz,
  total_count bigint,
  place_name text
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
    tc.elapsed_seconds,
    sp.created_at as saved_at,
    count(*) over () as total_count,
    af.place_name
  from saved_posts sp
  join activity_feed af on af.activity_id = sp.activity_id
  join profiles p on p.id = af.user_id
  left join trails t on t.id = af.trail_id
  left join trail_completions tc
    on af.activity_type = 'completion' and tc.id = af.activity_id
  where sp.user_id = p_user_id
  order by sp.created_at desc
  limit p_limit
  offset p_offset
$$;

revoke all on function public.get_saved_posts(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.get_saved_posts(uuid, integer, integer) to service_role;

-- PL/pgSQL checks its query only when it runs: run it once, so a mismatch fails the migration
do $$
begin
  perform * from public.get_activity_feed(
    (select id from public.profiles order by created_at limit 1), 50, 0
  );
end $$;

insert into public.schema_migrations (version, description)
values ('064', 'posts')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
