-- Migration 063: Saved posts.
--
-- Anyone can keep a post of the feed for later (a trip report, a photo of a pass, a condition
-- report) and find it again under Profile > Saved posts.
--
--   saved_posts (user_id, activity_id, activity_type, created_at)
--     One row per saved post. Only the API (service role) reads and writes it. 'post' is
--     allowed ahead of free-form posts.
--   get_saved_posts(p_user_id, p_limit, p_offset)
--     The saved posts that still exist, most recently saved first: the columns of
--     get_activity_feed (056) plus saved_at and total_count (all of them, for paging). Posts
--     without a trail come with null trail columns.
--
-- Plain SQL function (checked when created), security invoker, service role only.

begin;

create table if not exists public.saved_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null,
  activity_type text not null
    check (activity_type in ('completion', 'photo', 'condition', 'review', 'post')),
  created_at timestamptz not null default now(),
  primary key (user_id, activity_id)
);

create index if not exists saved_posts_user_created_idx
  on public.saved_posts (user_id, created_at desc);

alter table public.saved_posts enable row level security;
revoke all on public.saved_posts from public, anon, authenticated;

create or replace function public.get_saved_posts(
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
  total_count bigint
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
    count(*) over () as total_count
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

insert into public.schema_migrations (version, description)
values ('063', 'saved_posts')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
