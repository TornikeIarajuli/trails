-- Migration 068: Places beyond trails.
--
-- Named outdoor places of Georgia from OpenStreetMap: peaks, passes, lakes, waterfalls,
-- viewpoints, campsites, huts, caves, canyons, glaciers, castles, defensive towers,
-- monasteries, hot springs and fishing spots. scripts/content/13-places.mjs writes them to
-- content/places.json; scripts/content/14-places-apply.mjs loads that file here, upserting
-- on (osm_type, osm_id), so a rerun updates places in place and keeps their ids.
--
--   places (osm_type, osm_id, kind, name_en, name_ka, latitude, longitude, elevation_m,
--           region, wikidata, wikipedia, tags, notability, ...)
--     region: the region (trails.region) of the nearest trail start within 80 km, or null.
--     tags: a few OSM tags (ele, fee, drinking_water, capacity, website, opening_hours,
--           access, ...).
--     notability: a small score (Wikidata and Wikipedia links, a sight, an English name,
--           a photo, the kind) the API sorts by, highest first.
--
-- Only the API (service role) reads them; the app lists them through GET /places.

begin;

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  osm_type text not null check (osm_type in ('node', 'way', 'relation')),
  osm_id bigint not null,
  kind text not null check (kind in (
    'peak', 'pass', 'lake', 'waterfall', 'viewpoint', 'campsite', 'hut', 'cave', 'canyon',
    'glacier', 'castle', 'tower', 'monastery', 'hot_spring', 'fishing'
  )),
  name_en text not null,
  name_ka text,
  latitude double precision not null,
  longitude double precision not null,
  elevation_m integer,
  region text,
  wikidata text,
  wikipedia text,
  tags jsonb not null default '{}',
  notability smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (osm_type, osm_id)
);

create index if not exists places_kind_idx on public.places (kind);
create index if not exists places_region_idx on public.places (region);
create index if not exists places_lat_lng_idx on public.places (latitude, longitude);
create index if not exists places_notability_idx on public.places (notability desc);

alter table public.places enable row level security;
revoke all on public.places from public, anon, authenticated;

insert into public.schema_migrations (version, description)
values ('068', 'places')
on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
