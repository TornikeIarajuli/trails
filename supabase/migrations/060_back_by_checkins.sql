-- Migration 060: "Back by" check-ins.
--
-- At the start of a hike the hiker can say when they will be back. If they have not checked in
-- by then, they get a push ("Are you back?"); half an hour later their emergency contact gets
-- one, with the last position the app sent. Checking in (finishing the hike, "I'm back"), or the
-- finished hike reaching the server, closes it, and an emergency contact who was alerted hears
-- that the hiker is back.
--
-- The timing runs in the database (pg_cron, every minute) and the pushes go straight from here
-- to Expo (pg_net), so it works while the API server sleeps.
--
--   hike_checkins               one row per check-in; at most one open (active or alerted)
--                               per user. Service role only.
--   notify_user_push(...)       stores a notification and pushes it to the user's devices
--   process_hike_checkins()     the minute job: reminders, then alerts
--   close_checkins_on_hike()    trigger on hikes: a recorded hike that reaches the server
--                               closes the check-ins started before it ended

begin;

create extension if not exists pg_net with schema extensions;

create table if not exists public.hike_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trail_id uuid references public.trails(id) on delete set null,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  back_by timestamptz not null,
  last_lat double precision,
  last_lng double precision,
  last_position_at timestamptz,
  reminded_at timestamptz,
  alerted_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hike_checkins_status_check check (status in ('active', 'alerted', 'finished')),
  constraint hike_checkins_position_check check (
    (last_lat is null and last_lng is null)
    or (last_lat between -90 and 90 and last_lng between -180 and 180)
  )
);

create unique index if not exists hike_checkins_one_open
  on public.hike_checkins (user_id) where status in ('active', 'alerted');
create index if not exists hike_checkins_due
  on public.hike_checkins (back_by) where status = 'active';

alter table public.hike_checkins enable row level security;
revoke all on public.hike_checkins from public, anon, authenticated;
grant all on public.hike_checkins to service_role;

-- A notification, in the user's list and on their devices (Expo push, high priority).
create or replace function public.notify_user_push(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_data jsonb := coalesce(p_data, '{}'::jsonb) || jsonb_build_object('type', p_type);
  v_messages jsonb;
begin
  insert into notifications (user_id, type, title, body, data)
  values (p_user_id, p_type, p_title, p_body, v_data);

  select jsonb_agg(jsonb_build_object(
    'to', t.token,
    'sound', 'default',
    'title', p_title,
    'body', p_body,
    'data', v_data,
    'priority', 'high'
  ))
  into v_messages
  from (
    select token from push_tokens
    where user_id = p_user_id
    order by updated_at desc
    limit 100
  ) t;

  if v_messages is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := v_messages,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
  );
end;
$$;

-- Every minute: remind hikers at their back-by time, alert their emergency contact 30 minutes later.
create or replace function public.process_hike_checkins()
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  r record;
  v_trail text;
  v_name text;
  v_contact uuid;
  v_contact_name text;
  v_back text;
  v_seen text;
begin
  -- 1. At the back-by time: ask the hiker
  for r in
    update hike_checkins c
       set reminded_at = now(), updated_at = now()
     where c.status = 'active'
       and c.reminded_at is null
       and c.back_by <= now()
    returning c.*
  loop
    select t.name_en into v_trail from trails t where t.id = r.trail_id;
    select cp.username into v_contact_name
      from profiles p
      left join profiles cp on cp.id = p.emergency_contact_user_id
     where p.id = r.user_id;
    v_back := to_char(r.back_by at time zone 'Asia/Tbilisi', 'HH24:MI');

    perform notify_user_push(
      r.user_id,
      'checkin_reminder',
      'Are you back?',
      format(
        'You planned to be back from %s by %s. Check in now, or %s will be alerted in 30 minutes.',
        coalesce(v_trail, 'your hike'), v_back, coalesce(v_contact_name, 'your emergency contact')
      ),
      jsonb_build_object('checkinId', r.id)
        || case when r.trail_id is not null then jsonb_build_object('trailId', r.trail_id) else '{}'::jsonb end
    );
  end loop;

  -- 2. Half an hour later: alert the emergency contact
  for r in
    update hike_checkins c
       set status = 'alerted', alerted_at = now(), updated_at = now()
     where c.status = 'active'
       and c.back_by + interval '30 minutes' <= now()
    returning c.*
  loop
    select p.username, p.emergency_contact_user_id into v_name, v_contact
      from profiles p where p.id = r.user_id;
    continue when v_contact is null;

    select t.name_en into v_trail from trails t where t.id = r.trail_id;
    v_back := to_char(r.back_by at time zone 'Asia/Tbilisi', 'HH24:MI');
    v_seen := case
      when r.last_position_at is not null
        then to_char(r.last_position_at at time zone 'Asia/Tbilisi', 'HH24:MI')
    end;

    perform notify_user_push(
      v_contact,
      'overdue',
      format('%s hasn''t checked in', v_name),
      format(
        '%s planned to be back from %s by %s and hasn''t checked in.%s Try to reach them. If you can''t, call 112.',
        v_name,
        coalesce(v_trail, 'a hike'),
        v_back,
        case when v_seen is not null then format(' Last known position at %s.', v_seen) else '' end
      ),
      jsonb_build_object('userId', r.user_id, 'checkinId', r.id)
        || case when r.trail_id is not null then jsonb_build_object('trailId', r.trail_id) else '{}'::jsonb end
        || case
             when r.last_lat is not null
               then jsonb_build_object('lat', r.last_lat, 'lng', r.last_lng, 'positionAt', r.last_position_at)
             else '{}'::jsonb
           end
    );
  end loop;
end;
$$;

-- A recorded hike that reaches the server means the hiker is back: close the check-ins they
-- started before it ended (not one for a later hike), and tell an alerted contact.
create or replace function public.close_checkins_on_hike()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  r record;
  v_name text;
  v_contact uuid;
begin
  for r in
    update hike_checkins c
       set status = 'finished', finished_at = now(), updated_at = now()
     where c.user_id = new.user_id
       and c.status in ('active', 'alerted')
       and c.started_at <= coalesce(new.completed_at, now())
    returning c.*
  loop
    continue when r.alerted_at is null;
    select p.username, p.emergency_contact_user_id into v_name, v_contact
      from profiles p where p.id = r.user_id;
    continue when v_contact is null;
    perform notify_user_push(
      v_contact,
      'checkin_back',
      format('%s is back', v_name),
      format('%s has finished their hike and checked in.', v_name),
      jsonb_build_object('userId', r.user_id, 'checkinId', r.id)
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_close_checkins_on_hike on public.hikes;
create trigger trg_close_checkins_on_hike
  after insert on public.hikes
  for each row execute function public.close_checkins_on_hike();

revoke all on function public.notify_user_push(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.process_hike_checkins() from public, anon, authenticated;
revoke all on function public.close_checkins_on_hike() from public, anon, authenticated;
grant execute on function public.notify_user_push(uuid, text, text, text, jsonb) to service_role;

-- Every minute (re-running the migration replaces the job instead of adding another)
select cron.unschedule(jobid) from cron.job where jobname = 'process-hike-checkins';
select cron.schedule('process-hike-checkins', '* * * * *', 'select public.process_hike_checkins()');

insert into public.schema_migrations (version, description)
values ('060', 'back_by_checkins')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
