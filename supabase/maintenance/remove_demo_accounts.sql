-- One-off cleanup for a database that was seeded with demo accounts (NOT a migration: a
-- fresh database has none). Removes the accounts created by scripts/seed-test-users.js
-- (ids b0000000-0000-0000-0000-…, emails *@test.mikiritrails.com) and
-- scripts/create-test-users.ts (emails *@test.georgiatrails.app), and — through the
-- profiles foreign keys — everything they "posted": invented completions, reviews,
-- trail-condition reports, follows, bookmarks and badges.
--
-- Take a backup first if you may want the rows back; the delete cannot be undone.

begin;

create temp table _demo_users on commit drop as
select id
from auth.users
where id::text like 'b0000000-0000-0000-0000-%'
   or email like '%@test.mikiritrails.com'
   or email like '%@test.georgiatrails.app';

-- Refuse to run if the pattern matches implausibly many accounts.
do $$
declare
  n int;
begin
  select count(*) into n from _demo_users;
  if n > 60 then
    raise exception 'refusing to delete: % accounts matched the demo pattern', n;
  end if;
end $$;

delete from auth.users where id in (select id from _demo_users);

commit;

select
  (select count(*) from auth.users) as accounts_left,
  (select count(*) from public.trail_completions) as completions_left,
  (select count(*) from public.trail_reviews) as reviews_left,
  (select count(*) from public.trail_conditions) as conditions_left,
  (select count(*) from public.user_follows) as follows_left;
