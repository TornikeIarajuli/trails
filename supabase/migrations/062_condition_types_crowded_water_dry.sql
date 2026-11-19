-- Migration 062: Two more trail condition reports.
--
--   crowded    busy trail or full parking
--   water_dry  a spring, tap or stream on the way has run dry
--
-- Existing feed queries cast the type to text, so they pick the new values up as they are.
-- Safe to run again (IF NOT EXISTS).

begin;

alter type condition_type add value if not exists 'crowded';
alter type condition_type add value if not exists 'water_dry';

insert into public.schema_migrations (version, description)
values ('062', 'condition_types_crowded_water_dry')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
