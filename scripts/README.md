# scripts

## Trail content pipeline (`scripts/content/`)

Rebuilds the trail catalogue from the live data, OpenStreetMap, SRTM elevation and Wikimedia Commons, and
publishes it with one reviewed command. Every step reads and writes JSON under the top-level `content/` folder and
can be re-run; network responses are cached in `content/cache/` (git-ignored), so a re-run only fetches what is new.
Commands below are run from `scripts/`.

```sh
cd scripts && npm install          # @supabase/supabase-js, sharp

node content/01-snapshot.mjs        # published trails from the public API  -> content/snapshot/production-<date>.json
node content/02-osm-fetch.mjs       # OSM hiking relations, named features, boundaries (Overpass) -> content/work/osm-*.json
node content/03-existing-geometry.mjs   # sanity of every stored route; rebuild from OSM where safe -> work/existing-geometry.json
node content/04-new-trails.mjs      # OSM relations not in the catalogue, quality gates          -> work/new-geometry.json
node content/05-elevation.mjs       # SRTM profile per route (OpenTopoData, 1000 requests/day)    -> work/elevation.json
node content/06-photo-candidates.mjs    # geotagged Commons files along each route               -> work/photo-candidates.json
node content/06b-photo-places.mjs   # trails with nothing within 10 km: 25 km geotags + Wikidata places (same file)
node content/07-photos.mjs          # pick + resize photos -> content/images/<trail-id>/*.webp, contact sheets in work/sheets/
node content/09-build-dataset.mjs   # corrected values, checkpoints, provenance                    -> content/trails.json
node content/12-terrain.mjs         # OSM terrain along each route (Overpass) -> trails.json `terrain`, work/terrain.json
node content/10-seed.mjs            # supabase/seed.sql (trails + checkpoints, idempotent upserts)
node content/11-report.mjs          # content/REPORT.md, content/CREDITS.md, mobile/assets/data/photo-credits.json
node content/verify.mjs             # checks all of the above (exit code 1 on a problem)
npm test                            # unit tests (apply tool, EWKT, maths, stitching, terrain); repo root: node --test scripts/content/
node content/snapshot-to-sql.mjs    # optional: snapshot -> SQL, to load a local Supabase for an apply rehearsal
```

After looking at the contact sheets, add unsuitable files to `scripts/content/data/photo-review.json` and re-run
`07-photos.mjs` (only replacements are downloaded), then steps 09–11. Hand decisions live next to it in
`scripts/content/data/`: `geometry-overrides.json` (which OSM line is which trail when the data alone cannot tell),
`new-trail-overrides.json`, `text-overrides.json`, `relation-map.json` (trail → OSM relation, from the old import
scripts). Requests use the generic User-Agent `TrailContentTool/1.0 (hiking app content preparation)`.

### Publishing — `content/apply.mjs`

```sh
SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service role key> node content/apply.mjs          # dry run
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node content/apply.mjs --apply                                            # write
node content/apply.mjs --offline                    # dry run against content/snapshot/ (no keys, no network)
```

- Credentials come from the environment only (never printed); without them it refuses to start.
- `--offline` (or `--snapshot <file>`) plans against the latest production snapshot instead of the database: the
  same dry-run output, nothing read from the network, nothing written. Columns the snapshot predates are taken as
  their migration created them (NULL / `{}`), and the bucket is not checked (every photo counts as an upload).
- Dry run (default) reads the live rows and prints, per trail, every field it would change and the totals per table.
- `--apply` first writes the live `trails` (without routes), their routes, `trail_checkpoints` and `trail_media`
  rows to `content/backups/<timestamp>/`, then uploads images to the public `trail-media` bucket at
  `content/<trail-id>/<file>` (`image/webp`, one-year cache; files already there with the same size are skipped
  unless `--force`), updates the changed fields of existing trails, moves/updates checkpoints by id, replaces stock
  `trail_media` rows (URL contains `images.unsplash.com`) with the real photos — cover first (sort_order 0, the same
  URL as `cover_image_url`), caption `Photo: <author> · <licence> · Wikimedia Commons` — and inserts the new trails.
- It only changes a field whose live value is still what the snapshot saw; values edited since are reported and
  left alone (`--overwrite-conflicts` to override). An owner-uploaded cover and every non-stock media row are kept.
- Re-running is safe; a failing trail does not stop the others; the exit code is 1 if anything failed.
- Other flags: `--only <id,…>`, `--skip-images`, `--skip-new`, `--unpublished-new` (insert new trails unpublished),
  `--update-new` (overwrite new trails that already exist), `--dataset`, `--images`, `--backups`.
- Needs migrations 051 (`trails.elevation_profile`), 052 (`trails.review_flags`) and 053 (`trails.terrain`); it
  refuses a database without them. Columns added after a trail was first published (the first two) carry a baseline
  in `trails.json` (NULL and `{}`), so they are updated on earlier-published new trails without `--update-new`.
  `terrain` is derived from OSM and nobody edits it, so it has no baseline: it is written whenever the dataset has a
  value that differs from the live one (compared as JSON with sorted keys); a trail without terrain in the dataset
  leaves the live value alone. `reviewed_at`, `review_notes` and `gear_notes` belong to the team and are never written.

### Terrain (`trails.terrain`) — `content/12-terrain.mjs`

For the app's "What to bring" list. Run it after `09-build-dataset.mjs` (09 keeps the computed terrain of every
trail whose route is unchanged, from `content/work/terrain.json`; a changed route needs this step again).
Overpass is asked for small boxes along the routes (0.02° cells within 250 m of a route, a 0.2° block of them per
request, so trails sharing ground share requests — about 90 requests for the catalogue), cached in
`content/cache/overpass/`, one at a time with back-off on 429/504. (The polyline form of `around` returned nothing
on the main Overpass instance when this was written, so boxes are used and distances are applied locally.)

When the public Overpass instances are at capacity (as for days in November 2026), read a local extract instead:

```bash
curl -L -o content/cache/osm/georgia-latest.osm.pbf https://download.geofabrik.de/europe/georgia-latest.osm.pbf
node --max-old-space-size=6144 content/12-terrain.mjs --local content/cache/osm/georgia-YYMMDD.osm.pbf
```

`content/lib/osm-extract.mjs` answers the same query from the file (the same ways, fords, water points and shelters
per cell, in Overpass JSON form), so the rest of the step is unchanged; the terrain then dates from the extract.
Geofabrik's dated file name (`georgia-261113.osm.pbf`) gives that date. Reading the ~100 MB extract takes seconds.

```json
{ "source": "osm", "fetched_at": "2026-11-13", "coverage": 0.86, "max_sac": "T3",
  "sac_km": { "T1": 3.2, "T3": 1.1 }, "surfaces_km": { "ground": 5.0, "rock": 0.4 },
  "fords": 1, "water_points": 2, "shelters": 1 }
```

- The route is cut into ~20 m pieces; each is matched to the nearest way within 20 m among `highway` = path,
  footway, track, bridleway, steps, cycleway, pedestrian, unclassified, residential, service, tertiary,
  living_street. The full-resolution OSM line is used where the pipeline has it (rebuilt and new trails).
- `coverage` = matched share of the length (2 decimals). `sac_km` / `surfaces_km`: km per grade / surface bucket of
  the matched ways (1 decimal, only values > 0); a way without the tag adds to neither. `max_sac` = highest grade
  with at least 100 m, else null. SAC: hiking T1, mountain_hiking T2, demanding_mountain_hiking T3, alpine_hiking
  T4, demanding_alpine_hiking T5, difficult_alpine_hiking T6. Surfaces: paved (asphalt, concrete…, paved,
  paving_stones, sett, cobblestone, metal, wood), gravel (gravel, fine_gravel, compacted, unpaved, pebblestone),
  ground (ground, dirt, earth, mud, sand, soil), grass (grass, grass_paver, meadow), rock (rock, bare_rock, stone,
  scree, shingle), anything else other.
- `fords`: `ford=*` nodes and ways (not `ford=no`) within 25 m, hits within 100 m of each other counted once.
  `water_points`: drinking_water, spring, water_point, water_tap within 100 m, once within 50 m (springs tagged
  `drinking_water=no` left out). `shelters`: `amenity=shelter`, alpine and wilderness huts within 200 m, once within
  100 m (bus-stop shelters left out).
- The matching lives in `content/lib/terrain.mjs` (unit tests in `content/terrain.test.mjs`).

### Review flags (`trails.review_flags`)

`09-build-dataset.mjs` gives every trail an array of short, stable codes — reasons for an admin to look at it first.
They are derived from the checks the pipeline already records (`flags`, `provenance`) and written in this order:

| Code | Meaning |
|---|---|
| `manual_review` | the stored route could not be checked or rebuilt (broken line, no usable OSM relation) and was kept as it was; distance, ascent, time and difficulty may be unverified |
| `main_line` | recovered from a branching or broken OSM relation: the main line was picked, side or parallel ways left out |
| `rebuilt` | the route was rebuilt from OpenStreetMap, replacing the stored line |
| `reversed` | the route was turned round to run in the direction of the trail name |
| `generated_name` | the OSM relation had no name; the name was built from the OSM places at its ends |
| `machine_georgian` | Georgian text written by the pipeline (template description, name joined from OSM `name:ka`, or written by hand) — needs a native speaker |
| `near_border` | the route comes within 3 km of the occupation line or the state border |
| `overlap` | same name as another trail, or at least 80 % of one of the two lines runs within 100 m of the other (duplicate, variant, or a stage of a longer trek) |
| `synthetic_elevation` | `elevation_gain_m` is still the old synthetic distance × 60 / × 40 (the route could not be measured) |
| `estimated_checkpoints` | at least one checkpoint position could not be verified (placed by the original import at a fixed fraction of the route, or off the route) |
| `unconfirmed_facility` | a shelter, water source or campsite checkpoint has no matching OSM feature on the route (made not checkable) |
| `no_photo` | no photo at all (nothing usable on Commons and no upload by the owner) |
| `area_photo` | the cover photo was taken more than 5 km from the route, or shows a named place and has no location |

The list is `REVIEW_FLAG_CODES` in `content/apply-lib.mjs`; the apply tool refuses a dataset with other codes.

## Other scripts

- `check-migrations.js` — compares `supabase/migrations` with the `schema_migrations` table
  (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- `all_discovered_routes.json`, `discovered_trails.json`, `missing_routes.json` — inputs of the old import, kept as they are.

## `archive/`

The one-off OpenStreetMap import and route-repair scripts that produced the first catalogue (`fetch-*`,
`rebuild-seed*.js`, `generate-seed.js`, `fix-*`, `refetch-bad-routes.js`, `run-seed.js`), the demo-account scripts
(`seed-test-users.js`, `create-test-users.ts`) and their data files. They are superseded by the pipeline above and
kept for reference only. Several of them delete or overwrite data; the ones that talk to a database now require
explicit `SUPABASE_URL` / `SUPABASE_PROJECT_REF` / token environment variables — do not run them against production.
