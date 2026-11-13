# Backend API

NestJS 11 REST API for the hiking app, served under `/api`. It talks to Supabase
(Postgres + PostGIS, Auth, Storage) with the service-role key, so this API is the only
authorization layer: the database grants nothing to the `anon` / `authenticated` roles
(migration 044).

## Run locally

```bash
npm ci
cp .env.example .env   # fill in the three Supabase values
npm run start:dev      # http://localhost:3000/api, health check at /api/health
```

## Checks

```bash
npx tsc -p tsconfig.build.json --noEmit   # type-check
npm run lint                              # ESLint + Prettier, no autofix (npm run lint:fix fixes)
npm test                                  # unit tests (no network, no credentials)
npm run build                             # compile to dist/
```

`npm run test:e2e` runs `test/*.e2e-spec.ts` against a real Supabase project and needs
real credentials; do not point it at production.

## Configuration

Every variable is listed with its default in [`.env.example`](.env.example). Only
`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are required; all
others have defaults that work on Render behind Cloudflare.

## Deploying (Render)

- Build with `npm ci && npm run build`; start with `npm run start:prod` (`node dist/main`).
- Set the three Supabase variables, `NODE_ENV=production`, and optionally `SENTRY_DSN`
  and `WEB_ADMIN_URL`.
- Rate limits are keyed on the `CF-Connecting-IP` header. If the service is ever reached
  without Cloudflare in front, set `CLIENT_IP_HEADER=none` (otherwise clients could pick
  their own rate-limit key by sending that header).
- `INTERNAL_API_KEY` is optional; when set, give the web admin the same value so it
  sends `x-internal-key` instead of the service-role key.
- Apply the SQL migrations in `../supabase/migrations` by hand before deploying code that
  needs them. The API tolerates the `hikes` (048) and moderation (050) tables being
  missing: recorded tracks are then not stored and reports/blocks answer 503.

## Layout

One module per feature under `src/` (auth, trails, completions, media, ...). Shared code
lives in `src/common` (guards, validators, error mapping, cache) and the single Supabase
client provider in `src/config`. Hike verification is a pure function in
`src/completions/hike-verification.ts`.
