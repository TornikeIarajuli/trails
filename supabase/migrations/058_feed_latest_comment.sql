-- Migration 058: The latest comment under each feed post.
--
-- get_latest_comments returns the newest comment of each activity given, with the commenter's
-- username, leaving out comments by the users given (those the viewer blocked). The feed shows
-- it under a post, Instagram-style. One row per activity (distinct on), found through the
-- index on activity_comments(activity_id), so the feed never loads every comment's text.
--
-- Security invoker (the API calls it with the service role) and callable only by the service
-- role.

begin;

create or replace function public.get_latest_comments(
  p_activity_ids text[],
  p_hidden_user_ids uuid[] default '{}'
)
returns table (
  activity_id text,
  comment_id uuid,
  user_id uuid,
  username text,
  comment text,
  created_at timestamptz
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select distinct on (c.activity_id)
    c.activity_id,
    c.id,
    c.user_id,
    p.username,
    c.comment,
    c.created_at
  from activity_comments c
  inner join profiles p on p.id = c.user_id
  where c.activity_id = any(p_activity_ids)
    and not (c.user_id = any(coalesce(p_hidden_user_ids, '{}')))
  order by c.activity_id, c.created_at desc, c.id desc;
$$;

revoke all on function public.get_latest_comments(text[], uuid[]) from public, anon, authenticated;
grant execute on function public.get_latest_comments(text[], uuid[]) to service_role;

insert into public.schema_migrations (version, description)
values ('058', 'feed_latest_comment')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
