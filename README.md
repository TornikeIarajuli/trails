# Mikiri Trails

A hiking app for the country of Georgia. Hikers browse trails with routes, checkpoints and
photos, record their hikes with GPS, earn badges, review trails, report trail conditions,
follow each other and organise group hikes. An SOS button sends the hiker's location to an
emergency contact inside the app. A small admin panel manages the trail catalogue and
moderates user content.

## Architecture

```
 Mobile app (Expo / React Native) ──HTTPS──▶ NestJS API (Render) ──service role──▶ Supabase
                                                                                    (Postgres 17 + PostGIS,
 Admin panel + legal pages (Next.js, Vercel) ─────────────service role────────────▶  Auth, Storage)
```

- The **mobile app** talks only to the API. It never connects to Supabase directly.
- The **API** is the only authorization layer for app users: every database and storage call
  uses the Supabase service-role key, and the public schema is closed to the `anon` and
  `authenticated` roles (migration 044).
- The **admin panel** writes to Supabase directly with the service-role key from server
  actions, behind one shared HTTP Basic sign-in. After changing a trail it asks the API to drop
  its cached copy (`DELETE /api/trails/:id/cache`). It also serves the public Terms and Privacy
  pages at `/legal/terms` and `/legal/privacy`.
- Push notifications go through Expo's push service; product analytics through PostHog (mobile);
  API errors to Sentry.

## Repository layout

| Path | What it is |
|---|---|
| `mobile/` | Expo SDK 54 app (React Native 0.81, expo-router, TanStack Query, zustand) |
| `backend/` | NestJS 11 REST API, served under `/api` |
| `web/` | Next.js 16 admin panel and legal pages |
| `supabase/migrations/` | Numbered SQL migrations, applied by hand in order (see below) |
| `supabase/seed.sql` | Demo trail data for a **fresh development database only** (it truncates the trail tables) |
| `supabase/maintenance/` | One-off maintenance SQL, not part of the migration sequence |
| `scripts/` | OpenStreetMap import and route-repair scripts; `scripts/content/` is the content pipeline (snapshots, OSM routes, elevation, photos) |
| `content/` | Output of the content pipeline (snapshots, working files, photo credits) |
| `.maestro/` | Maestro end-to-end flows for the mobile app |
| `.github/workflows/ci.yml` | Continuous integration |

Each package has its own `package.json` and lockfile; there is no root package.

## Prerequisites

- Node.js 22 LTS, 22.18 or newer (CI uses 22; the web unit tests rely on Node running
  TypeScript files directly), and npm 10 or newer.
- A Supabase project with the migrations applied (see below), and its URL, anon key and
  service-role key.
- Supabase CLI v3, to apply migrations.
- For the mobile app: Android Studio and/or Xcode for development builds, and an Expo account
  with the EAS CLI (`npm i -g eas-cli`) for store builds.

## Running locally

### API (`backend/`)

```bash
cd backend
npm ci
# set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (e.g. in backend/.env)
npm run start:dev          # http://localhost:3000/api, health check: GET /api/health
```

### Admin panel (`web/`)

```bash
cd web
npm ci
cp .env.example .env.local # then fill in the values
npm run dev                # http://localhost:3000 (use another port if the API runs there: npm run dev -- -p 3001)
```

The browser asks for the `ADMIN_USERNAME` / `ADMIN_PASSWORD` sign-in.

### Mobile app (`mobile/`)

```bash
cd mobile
npm ci                     # .npmrc sets legacy-peer-deps
EXPO_PUBLIC_API_URL=http://<your-computer's-LAN-IP>:3000/api npx expo start
```

Without `EXPO_PUBLIC_API_URL` the app uses the production API. Background location during a
hike and push notifications need a development build (`npx expo run:android`,
`npx expo run:ios`, or `eas build --profile development`) rather than Expo Go.

## Environment variables

Never commit real values. Only `web/.env.example` is tracked.

### API (Render)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `SUPABASE_URL` | yes | | Supabase project URL |
| `SUPABASE_ANON_KEY` | yes | | Supabase anon key, used for the sign-in and sign-up calls to Supabase Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | | Supabase service-role key, used for all database and storage access |
| `PORT` | no | `3000` | HTTP port |
| `NODE_ENV` | no | | `production` enables Sentry |
| `SENTRY_DSN` | no | | Sentry project DSN for error reports |
| `WEB_ADMIN_URL` | no | | Extra allowed CORS origin |
| `INTERNAL_API_KEY` | no | | Shared secret for the admin panel's cache invalidation (`x-internal-key`); the legacy `x-service-key` header is still accepted |
| `CLIENT_IP_HEADER` | no | `cf-connecting-ip` | Request header that carries the real client IP (used for rate limiting) |
| `TRUST_PROXY_HOPS` | no | `1` | Number of reverse proxies Express trusts when deriving the client IP |
| `MAX_UPLOAD_MB` | no | `12` | Largest accepted upload, in MB |
| `HIKE_MIN_COVERAGE` | no | `0.6` | Share of a trail's route a recorded track must pass near for the hike to be verified |
| `HIKE_TOLERANCE_M` | no | `120` | How close (metres) the track must pass to a route point to cover it |
| `HIKE_MAX_SPEED_KMH` | no | `15` | Average speed above which a hike is not verified |

### Admin panel (Vercel)

See [`web/.env.example`](web/.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | yes | Supabase project URL (`NEXT_PUBLIC_SUPABASE_URL` is read as a fallback) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service-role key; server-only. The old name `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` still works but logs a warning: rename it |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | yes | The panel's HTTP Basic sign-in. If either is missing, every page answers 503 |
| `BACKEND_URL` | no | API base URL including `/api`; defaults to the production API |
| `INTERNAL_API_KEY` | no | Same value as the API's; without it the panel sends the legacy header |

Files uploaded through the panel are limited to 4 MB (Vercel rejects larger request bodies).

### Mobile app (EAS / `.env`)

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | API base URL including `/api`; defaults to the production API |
| `EXPO_PUBLIC_POSTHOG_KEY` | PostHog project key; analytics are off when it is unset |

`EXPO_PUBLIC_*` values are compiled into the app and readable by anyone who has it: never put
a secret there.

### Scripts (`scripts/`)

| Variable | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | seeding, test users, `scripts/content/apply.mjs` | Direct database access |
| `SUPABASE_MGMT_TOKEN` | route-repair scripts | Supabase personal access token for the Management API (runs SQL) |
| `TRAILS_API_URL` | `scripts/content/01-snapshot.mjs` | API to snapshot; defaults to the production API |

## Database and migrations

There is **one Supabase project today, and it is production** (Postgres 17). A second project
for development and for trying migrations before they reach production is strongly
recommended; until then, test every migration against a local or throw-away database first.

- Migrations are the numbered files in `supabase/migrations/`, applied **in order**, by hand.
  CI does not apply them.
- They are applied with Supabase CLI v3 against the linked project:

  ```bash
  supabase link --project-ref <project-ref>
  supabase db query --remote -f supabase/migrations/050_moderation.sql
  ```

- `public.schema_migrations` lists the applied migrations (created by 028; 044 back-filled the
  ones in between that did not record themselves, and every newer file inserts its own row).
  Check it with `select version, applied_at from schema_migrations order by version;`.
- Never run `supabase/seed.sql` against production: it truncates the trail tables.

## Releasing

Release in this order, so that each part finds what it depends on:

1. **Database migrations** (new tables and columns first).
2. **API** on Render; check `GET /api/health`. It stays backward compatible with app builds
   already on phones.
3. **Admin panel** on Vercel (a push to `main` redeploys it).
4. **Mobile build** with EAS (`eas build --profile production`), then store submission.

New environment variables are optional and have safe defaults, so a release does not depend
on setting them first.

## Tests and CI

| Package | Commands |
|---|---|
| `backend/` | `npm run lint`, `npm test` (Jest unit tests), `npm run test:e2e`, `npm run build` |
| `mobile/` | `npx tsc --noEmit`, `npm test` (Jest with jest-expo) |
| `web/` | `npx tsc --noEmit`, `npm run lint`, `npm test` (Node test runner), `npm run build` |

End-to-end flows for the app are in `.maestro/` (see its README).

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and on pull requests to `main`:
lint, unit tests and build for the API; type-check and unit tests for the app; type-check,
lint, unit tests and build for the admin panel; and a gitleaks secret scan of the newly pushed
commits. CI does not deploy anything and does not touch the database.

## Data sources and licences

- **Trail routes and map data**: © OpenStreetMap contributors, available under the Open
  Database License (ODbL).
- **Trail photos**: from Wikimedia Commons, each under its own licence. The credit for each
  photo is stored with it (`trail_media.caption`), listed in `content/CREDITS.md`, and shipped
  in the app (`mobile/assets/data/photo-credits.json`).
- **Elevation**: NASA Shuttle Radar Topography Mission (SRTM).

See [NOTICE.md](NOTICE.md). There is no open-source licence for the code in this repository.
