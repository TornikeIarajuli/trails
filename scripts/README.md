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
node content/10-seed.mjs            # supabase/seed.sql (trails + checkpoints, idempotent upserts)
node content/11-report.mjs          # content/REPORT.md, content/CREDITS.md, mobile/assets/data/photo-credits.json
node content/verify.mjs             # checks all of the above (exit code 1 on a problem)
npm test                            # unit tests (apply tool, EWKT, maths, stitching)
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
```

- Credentials come from the environment only (never printed); without them it refuses to start.
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
- Needs migrations 051 (`trails.elevation_profile`) and 052 (`trails.review_flags`); it refuses a database without
  them. Columns added after a trail was first published (these two) carry a baseline in `trails.json` (NULL and `{}`),
  so they are updated on earlier-published new trails without `--update-new`. `reviewed_at` and `review_notes` belong
  to the admins and are never written.

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
