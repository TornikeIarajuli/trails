-- Migration 049: A push token identifies one device, so it belongs to one account.
--
-- The table was unique on (user_id, token), so after a second account signed in on the same
-- phone both accounts' notifications (including SOS alerts) were delivered to that phone.
-- Keep the most recently updated row per token and enforce uniqueness on the token itself.

begin;

delete from public.push_tokens a
using public.push_tokens b
where a.token = b.token
  and (a.updated_at, a.id) < (b.updated_at, b.id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'push_tokens_token_key' and conrelid = 'public.push_tokens'::regclass
  ) then
    alter table public.push_tokens add constraint push_tokens_token_key unique (token);
  end if;
end $$;

insert into public.schema_migrations (version, description)
values ('049', 'push_tokens_one_owner')
on conflict (version) do nothing;

commit;
