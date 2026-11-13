-- Migration 053: Recommended gear per trail.
--
-- The app builds a "What to bring" list for each trail from data it already has (length,
-- time, ascent, altitude, season, weather, flags). Three things feed it from here:
--   trails.gear_notes    free text the team writes for one trail (permits, river crossings,
--                        seasonal snow…), shown above the automatic list.
--   trails.terrain       terrain facts from OpenStreetMap along the route, published by the
--                        content pipeline, e.g. {"max_sac": "T3", "sac_km": {"T2": 4.1, "T3": 1.2},
--                        "surfaces_km": {"ground": 5.0, "rock": 0.4}, "fords": 1}.
--   products.gear_tags   gear item keys a shop product covers (e.g. {headlamp}), so a
--                        checklist item can link to it.

begin;

alter table public.trails
  add column if not exists gear_notes text,
  add column if not exists terrain jsonb;

alter table public.products
  add column if not exists gear_tags text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'trails_gear_notes_length' and conrelid = 'public.trails'::regclass
  ) then
    alter table public.trails
      add constraint trails_gear_notes_length
      check (gear_notes is null or char_length(gear_notes) <= 2000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'trails_terrain_is_object' and conrelid = 'public.trails'::regclass
  ) then
    alter table public.trails
      add constraint trails_terrain_is_object
      check (terrain is null or jsonb_typeof(terrain) = 'object');
  end if;
end $$;

insert into public.schema_migrations (version, description)
values ('053', 'gear')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
