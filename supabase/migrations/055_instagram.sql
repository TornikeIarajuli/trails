-- Migration 055: Instagram on profiles.
--
-- profiles.instagram_handle holds the plain Instagram username (no "@", no link), shown as a
-- tappable link on the profile. Instagram usernames are 1–30 letters, digits, dots and
-- underscores; the API normalises "@name" and pasted profile links before saving.

begin;

alter table public.profiles
  add column if not exists instagram_handle text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_instagram_handle_format' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_instagram_handle_format
      check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$');
  end if;
end $$;

insert into public.schema_migrations (version, description)
values ('055', 'instagram')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
