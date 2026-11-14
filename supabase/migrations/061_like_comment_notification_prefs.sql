-- Migration 061: Turning off like and comment notifications.
--
-- notification_preferences gets new_like and new_comment, on by default like the others. The
-- API skips a push whose type is a preference the user turned off, so the column names are
-- the notification types. Safety notifications (SOS, "Back by") have no preference and are
-- always sent.

begin;

alter table public.notification_preferences
  add column if not exists new_like boolean not null default true,
  add column if not exists new_comment boolean not null default true;

insert into public.schema_migrations (version, description)
values ('061', 'like_comment_notification_prefs')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
