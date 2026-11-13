-- Migration 048: Store every recorded hike with its GPS track.
--
-- Until now the server kept only "user X completed trail Y" and a duration; the track never
-- left the phone, so a completion could not be verified or reviewed, repeat hikes of the
-- same trail left no trace, and distance statistics were impossible. The API now verifies
-- the submitted track against the trail's route and stores each attempt here.

begin;

create table if not exists public.hikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trail_id uuid not null references public.trails(id) on delete cascade,
  completion_id uuid references public.trail_completions(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz not null default now(),
  elapsed_seconds int check (elapsed_seconds is null or elapsed_seconds >= 0),
  distance_m int check (distance_m is null or distance_m >= 0),
  track geometry(LineString, 4326),
  -- share of the trail's route vertices the track passed close to (0..1)
  coverage numeric(4, 3) check (coverage is null or (coverage >= 0 and coverage <= 1)),
  verified boolean not null default false,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists hikes_user_completed_idx on public.hikes (user_id, completed_at desc);
create index if not exists hikes_trail_idx on public.hikes (trail_id);
create index if not exists hikes_completion_idx on public.hikes (completion_id);

alter table public.hikes enable row level security;
revoke all on table public.hikes from public, anon, authenticated;
grant all on table public.hikes to service_role;

insert into public.schema_migrations (version, description)
values ('048', 'hikes')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
