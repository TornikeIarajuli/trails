-- Migration 047: profiles.total_trails_completed is derived from trail_completions.
--
-- The counter was maintained by application code calling increment/decrement RPCs, so every
-- path that skipped them (admin panel deletes, trail deletes that cascade, failed RPC calls,
-- manual updates) left it wrong, and the leaderboard sorts on it. A trigger now recomputes
-- it for the affected user whenever an approved completion appears, disappears or changes
-- status, and the existing values are corrected once.

begin;

create or replace function public.sync_user_trail_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
begin
  foreach v_user in array array[
    case when tg_op <> 'INSERT' then old.user_id end,
    case when tg_op <> 'DELETE' then new.user_id end
  ]
  loop
    if v_user is not null then
      update profiles p
      set total_trails_completed = c.n
      from (
        select count(*)::int as n
        from trail_completions
        where user_id = v_user and status = 'approved'
      ) c
      where p.id = v_user
        and p.total_trails_completed is distinct from c.n;
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.sync_user_trail_count() from public, anon, authenticated;

drop trigger if exists trg_sync_user_trail_count on public.trail_completions;
create trigger trg_sync_user_trail_count
  after insert or delete or update of status, user_id on public.trail_completions
  for each row execute function public.sync_user_trail_count();

-- One-time correction of every profile.
update public.profiles p
set total_trails_completed = c.n
from (
  select pr.id, count(tc.id) filter (where tc.status = 'approved')::int as n
  from public.profiles pr
  left join public.trail_completions tc on tc.user_id = pr.id
  group by pr.id
) c
where p.id = c.id
  and p.total_trails_completed is distinct from c.n;

insert into public.schema_migrations (version, description)
values ('047', 'trail_count_trigger')
on conflict (version) do nothing;

commit;
