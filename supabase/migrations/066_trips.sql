-- Migration 066: Group hikes become trip plans: several days, public or private, and a chat
-- for the people going.
--
--   events.visibility       'public' (listed, anyone can join, as before) or 'private' (not
--                           listed; opened from a shared link, then joined)
--   event_days              day 2 onwards of a multi-day trip: a trail, or a day without one
--                           (a title such as "Rest day in Mestia"), and a note. Day 1 is the
--                           event's own trail and date.
--   event_messages          the trip's chat; only participants read and write it (the API
--                           checks). Kept with the event, deleted with it.
--   content_reports         accepts 'message' (a chat message).
--   notification_preferences.group_chat
--                           push for new chat messages, on by default (the API skips a push
--                           whose type is a preference turned off, like 061).
--
-- Only the API (service role) reads and writes the new tables.

begin;

alter table public.events
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'private'));

create table if not exists public.event_days (
  event_id uuid not null references public.events(id) on delete cascade,
  day_number smallint not null check (day_number between 2 and 14),
  trail_id uuid references public.trails(id) on delete set null,
  title text check (title is null or char_length(title) between 1 and 80),
  note text check (note is null or char_length(note) <= 500),
  primary key (event_id, day_number)
);

create table if not exists public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists event_messages_event_created_idx
  on public.event_messages (event_id, created_at desc);

alter table public.event_days enable row level security;
alter table public.event_messages enable row level security;
revoke all on public.event_days from public, anon, authenticated;
revoke all on public.event_messages from public, anon, authenticated;

alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add constraint content_reports_target_type_check
  check (target_type in ('photo', 'comment', 'review', 'condition', 'event', 'user', 'completion', 'trail', 'post', 'message'));

alter table public.notification_preferences
  add column if not exists group_chat boolean not null default true;

insert into public.schema_migrations (version, description)
values ('066', 'trips')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
