-- Migration 067: Local guides and booking requests.
--
-- A hiker can apply to be listed as a guide; the team verifies them in the admin. Verified
-- guides appear in the app (by region and trail), and hikers send them booking requests,
-- which the guide accepts or declines. A guide's phone and messengers are shown only to
-- hikers whose request they accepted (the API checks). No payments: they settle directly.
--
--   guides (user_id, status, headline, bio, regions, languages, certifications, price_gel,
--           price_note, contact_phone, contact_whatsapp, contact_telegram, trail_ids, ...)
--     status: pending (applied), verified (listed), rejected (with admin_note), paused (the
--     guide took the listing down for now).
--   guide_bookings (guide_id, hiker_id, trail_id, start_date, days, group_size, message,
--                   status, guide_reply)
--     status: requested, accepted, declined, cancelled (by the hiker).
--
-- Only the API and the admin (service role) read and write them.

begin;

create table if not exists public.guides (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected', 'paused')),
  headline text not null check (char_length(headline) between 3 and 80),
  bio text not null check (char_length(bio) between 20 and 2000),
  regions text[] not null default '{}',
  languages text[] not null default '{}',
  certifications text check (certifications is null or char_length(certifications) <= 300),
  price_gel integer check (price_gel is null or price_gel between 0 and 100000),
  price_note text check (price_note is null or char_length(price_note) <= 200),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 30),
  contact_whatsapp boolean not null default false,
  contact_telegram text check (contact_telegram is null or char_length(contact_telegram) <= 40),
  trail_ids uuid[] not null default '{}',
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists guides_status_idx on public.guides (status);

create table if not exists public.guide_bookings (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.guides(user_id) on delete cascade,
  hiker_id uuid not null references public.profiles(id) on delete cascade,
  trail_id uuid references public.trails(id) on delete set null,
  start_date date not null,
  days smallint not null default 1 check (days between 1 and 30),
  group_size smallint not null check (group_size between 1 and 50),
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'declined', 'cancelled')),
  guide_reply text check (guide_reply is null or char_length(guide_reply) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (guide_id <> hiker_id)
);

create index if not exists guide_bookings_guide_idx on public.guide_bookings (guide_id, created_at desc);
create index if not exists guide_bookings_hiker_idx on public.guide_bookings (hiker_id, created_at desc);

alter table public.guides enable row level security;
alter table public.guide_bookings enable row level security;
revoke all on public.guides from public, anon, authenticated;
revoke all on public.guide_bookings from public, anon, authenticated;

insert into public.schema_migrations (version, description)
values ('067', 'guides')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
