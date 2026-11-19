// Step 14 — loads content/places.json into public.places (migration 068).
//
//   SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service role key> node scripts/content/14-places-apply.mjs
//   node scripts/content/14-places-apply.mjs --dry-run      # checks and counts only: no keys, no network
//   [--file <places.json>]
//
// Upserts through the REST API in batches of 500 (POST /rest/v1/places?on_conflict=osm_type,osm_id with
// Prefer: resolution=merge-duplicates), so a rerun updates every place in place (its id stays) and adds new ones;
// places no longer in the file are left alone. Credentials come from the environment only and are never printed.
// The file is checked first; nothing is sent when an entry is malformed or listed twice.
import path from 'node:path';
import { CONTENT, readJson } from './lib/paths.mjs';
import { KINDS, chunk, placeProblems, placeRow } from './lib/places.mjs';
import { sleep } from './lib/http.mjs';

const BATCH = 500;
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fileArg = args.indexOf('--file');
const file = fileArg >= 0 ? path.resolve(args[fileArg + 1]) : path.join(CONTENT, 'places.json');

const places = readJson(file);
if (!Array.isArray(places)) throw new Error(`${file} is not a list of places`);

const problems = [];
const seen = new Set();
places.forEach((p, i) => {
  for (const problem of placeProblems(p)) problems.push(`#${i} ${p.osm_type}/${p.osm_id}: ${problem}`);
  const key = `${p.osm_type}/${p.osm_id}`;
  if (seen.has(key)) problems.push(`#${i} ${key}: listed twice`);
  seen.add(key);
});
if (problems.length) {
  console.error(`${problems.length} problem(s) in ${path.basename(file)}, nothing sent:\n  ${problems.slice(0, 20).join('\n  ')}`);
  process.exit(1);
}

const perKind = Object.fromEntries(KINDS.map((k) => [k, 0]));
for (const p of places) perKind[p.kind]++;
const batches = chunk(places, BATCH);
console.log(`${places.length} places in ${path.basename(file)}: ${KINDS.map((k) => `${k} ${perKind[k]}`).join(', ')}`);

if (dryRun) {
  console.log(`dry run: would upsert ${places.length} places in ${batches.length} batch(es) of up to ${BATCH}; nothing sent`);
  process.exit(0);
}

const base = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!base || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (or run with --dry-run).');
  process.exit(1);
}
const endpoint = `${base}/rest/v1/places?on_conflict=osm_type,osm_id`;

class MissingTable extends Error {}

/** One batch; retried on 429, 5xx and network errors. Errors carry the database's message, never the URL or key. */
async function upsert(rows) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(rows),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      if (attempt >= 3) throw new Error(`request failed: ${err.name}`);
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    if (res.ok) return;
    const text = await res.text().catch(() => '');
    if (/PGRST205|42P01/.test(text)) throw new MissingTable();
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
}

const updatedAt = new Date().toISOString();
let written = 0;
let failed = 0;
for (const [i, batch] of batches.entries()) {
  try {
    await upsert(batch.map((p) => placeRow(p, updatedAt)));
    written += batch.length;
    console.log(`  batch ${i + 1}/${batches.length}: ${written} of ${places.length}`);
  } catch (err) {
    if (err instanceof MissingTable) {
      console.error('public.places does not exist: apply supabase/migrations/068_places.sql first.');
      process.exit(1);
    }
    failed += batch.length;
    console.error(`  batch ${i + 1}/${batches.length} failed — ${err.message}`);
  }
}
console.log(`places: ${written} upserted${failed ? `, ${failed} failed (run again)` : ''}`);
if (failed) process.exit(1);
