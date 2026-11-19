-- Migration 069: The daily outlook: go, wait or skip for every published trail.
--
-- A trail's page judges the coming days from the mountain forecast at its highest point. Once
-- a day the API does the same for every published trail and keeps the answers here, so the
-- app can list the good days ahead (Feed > Good days), and hikers hear when a trail they
-- bookmarked gets one (one push per person per day at most).
--
--   trail_outlook (trail_id, day, verdict, label, headline, temp_min_c, temp_max_c, computed_at)
--     today and the six days after it (Georgian dates). verdict: go, wait or skip; label as
--     on the trail page ("Go", "Go early", "Wait"...); headline ("Dry and calm"). The job
--     deletes the days that have passed.
--   weather_alerts_sent (user_id, trail_id, day, sent_at)
--     good-weather pushes already sent, so a trail's good day is announced once.
--   outlook_runs (day, started_at, finished_at, trails, alerts)
--     one row per Georgian date. Once a run has finished, the retry and any later call that
--     day do nothing.
--   cron_tokens (name, token)
--     shared secrets pg_cron sends to the API (header x-cron-token). 'outlook' is created here
--     with a random token; the API reads it from this table.
--   notification_preferences.good_weather
--     the good-weather push, on by default (the API skips a push whose type is a preference
--     turned off, like 061).
--
-- pg_cron calls the API at 13:30 UTC (17:30 in Tbilisi), and again at 13:50 in case the first
-- call found the server asleep. The API's address is written into both jobs: if the API moves,
-- schedule them again with the new URL.
--
-- Only the API (service role) reads and writes the new tables.

begin;

create extension if not exists pg_net with schema extensions;

create table if not exists public.trail_outlook (
  trail_id uuid not null references public.trails(id) on delete cascade,
  day date not null,
  verdict text not null check (verdict in ('go', 'wait', 'skip')),
  label text not null,
  headline text not null,
  temp_min_c real,
  temp_max_c real,
  computed_at timestamptz not null default now(),
  primary key (trail_id, day)
);

create index if not exists trail_outlook_go_day_idx
  on public.trail_outlook (day) where verdict = 'go';

create table if not exists public.weather_alerts_sent (
  user_id uuid not null references public.profiles(id) on delete cascade,
  trail_id uuid not null references public.trails(id) on delete cascade,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, trail_id, day)
);

create table if not exists public.outlook_runs (
  day date primary key,
  started_at timestamptz,
  finished_at timestamptz,
  trails integer,
  alerts integer
);

create table if not exists public.cron_tokens (
  name text primary key,
  token text not null
);

insert into public.cron_tokens (name, token)
values (
  'outlook',
  left(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 48)
)
on conflict (name) do nothing;

alter table public.notification_preferences
  add column if not exists good_weather boolean not null default true;

alter table public.trail_outlook enable row level security;
alter table public.weather_alerts_sent enable row level security;
alter table public.outlook_runs enable row level security;
alter table public.cron_tokens enable row level security;
revoke all on public.trail_outlook from public, anon, authenticated;
revoke all on public.weather_alerts_sent from public, anon, authenticated;
revoke all on public.outlook_runs from public, anon, authenticated;
revoke all on public.cron_tokens from public, anon, authenticated;

-- 17:30 in Tbilisi, and a retry at 17:50 (re-running the migration replaces the jobs instead
-- of adding more). The token is read from cron_tokens at each call.
select cron.unschedule(jobid) from cron.job where jobname in ('daily-outlook', 'daily-outlook-retry');

select cron.schedule('daily-outlook', '30 13 * * *', $job$
  select net.http_post(
    url := 'https://trails-en04.onrender.com/api/internal/outlook/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', (select token from public.cron_tokens where name = 'outlook')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
$job$);

select cron.schedule('daily-outlook-retry', '50 13 * * *', $job$
  select net.http_post(
    url := 'https://trails-en04.onrender.com/api/internal/outlook/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', (select token from public.cron_tokens where name = 'outlook')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
$job$);

insert into public.schema_migrations (version, description)
values ('069', 'outlook')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
