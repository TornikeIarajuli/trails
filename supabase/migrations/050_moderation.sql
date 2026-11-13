-- Migration 050: Reporting and blocking.
--
-- The app publishes user content (photos, comments, reviews, condition reports, events,
-- profiles) but had no way for a user to report it or to block another user. Both app
-- stores require this for apps with user-generated content.

begin;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null
    check (target_type in ('photo', 'comment', 'review', 'condition', 'event', 'user', 'completion')),
  target_id text not null,
  reason text not null
    check (reason in ('spam', 'offensive', 'harassment', 'dangerous', 'other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create index if not exists content_reports_status_idx
  on public.content_reports (status, created_at desc);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.content_reports enable row level security;
alter table public.user_blocks enable row level security;
revoke all on table public.content_reports, public.user_blocks from public, anon, authenticated;
grant all on table public.content_reports, public.user_blocks to service_role;

insert into public.schema_migrations (version, description)
values ('050', 'moderation')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
