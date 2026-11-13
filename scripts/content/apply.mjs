#!/usr/bin/env node
// Publishes content/trails.json (+ content/images) to a Supabase project.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/content/apply.mjs            # dry run
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/content/apply.mjs --apply    # write
//
// Flags: --only <trail-id,…>  --skip-images  --skip-new  --unpublished-new  --force
//        --overwrite-conflicts  --update-new  --dataset <file>  --images <dir>  --backups <dir>
// See scripts/README.md for what each one does.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BUCKET, CACHE_CONTROL_SECONDS, STORAGE_PREFIX,
  describePlan, parseArgs, planHasWrites, planTrail, summarize, validateDataset,
} from './apply-lib.mjs';

const HELP = `Publishes content/trails.json and content/images to Supabase.

Environment (required, never printed): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

  (no flag)              dry run: read the live rows and print what would change
  --apply                perform the writes (backs the touched rows up first)
  --only <id,id,…>       limit to these trail ids
  --skip-images          leave images, cover_image_url and trail_media alone (data only)
  --skip-new             do not insert new trails
  --unpublished-new      insert new trails with is_published = false
  --force                upload images even when the bucket already has the same file
  --overwrite-conflicts  overwrite fields whose live value changed since the snapshot
  --update-new           overwrite fields of new trails that were already inserted
  --dataset <file>       default: content/trails.json
  --images <dir>         default: content/images
  --backups <dir>        default: content/backups`;

/** Thin wrapper over supabase-js so the tool can be exercised with an in-memory fake. */
export function supabaseAdapter(client) {
  const ok = (res, what) => {
    if (res.error) throw new Error(`${what}: ${res.error.message ?? JSON.stringify(res.error)}`);
    return res.data;
  };
  return {
    async selectIn(table, column, ids) {
      const rows = [];
      for (let i = 0; i < ids.length; i += 40) {
        const chunk = ids.slice(i, i + 40);
        for (let from = 0; ; from += 1000) {
          const data = ok(
            await client.from(table).select('*').in(column, chunk).order('id', { ascending: true }).range(from, from + 999),
            `read ${table}`,
          );
          rows.push(...data);
          if (data.length < 1000) break;
        }
      }
      return rows;
    },
    async insertRows(table, rows) {
      ok(await client.from(table).insert(rows), `insert into ${table}`);
    },
    async upsertRows(table, rows) {
      ok(await client.from(table).upsert(rows, { onConflict: 'id' }), `upsert into ${table}`);
    },
    async updateById(table, id, patch) {
      const data = ok(await client.from(table).update(patch).eq('id', id).select('id'), `update ${table} ${id}`);
      return data.length;
    },
    async deleteByIds(table, ids) {
      const data = ok(await client.from(table).delete().in('id', ids).select('id'), `delete from ${table}`);
      return data.length;
    },
    async listObjects(prefix) {
      const data = ok(await client.storage.from(BUCKET).list(prefix, { limit: 1000 }), `list ${BUCKET}/${prefix}`);
      return (data ?? []).filter((o) => o.metadata).map((o) => ({ name: o.name, size: Number(o.metadata.size) }));
    },
    async uploadObject(storagePath, buffer) {
      ok(
        await client.storage.from(BUCKET).upload(storagePath, buffer, {
          contentType: 'image/webp',
          cacheControl: CACHE_CONTROL_SECONDS,
          upsert: true,
        }),
        `upload ${BUCKET}/${storagePath}`,
      );
    },
  };
}

const group = (rows, key) => {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r[key])) map.set(r[key], []);
    map.get(r[key]).push(r);
  }
  return map;
};

function writeBackup(dir, live, plans, opts) {
  fs.mkdirSync(dir, { recursive: true });
  const write = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 1));
  write('trails.json', live.trails.map(({ route, ...rest }) => rest));
  write('trail_routes.json', live.trails.map((t) => ({ id: t.id, route: t.route })));
  write('trail_checkpoints.json', live.checkpoints);
  write('trail_media.json', live.media);
  write('plan.json', { created_at: new Date().toISOString(), options: { ...opts, supabaseUrl: undefined }, plans });
}

/**
 * db: adapter (see supabaseAdapter); dataset: parsed trails.json; opts: parseArgs() result + supabaseUrl.
 * Returns { exitCode, plans, failures, summary }.
 */
export async function run({ db, dataset, opts, imagesDir, backupsDir, log = console.log, now = () => new Date() }) {
  const problems = validateDataset(dataset);
  if (problems.length) {
    log(`The dataset is not valid — nothing was done:\n  ${problems.slice(0, 40).join('\n  ')}`);
    return { exitCode: 1, plans: [], failures: [], summary: null };
  }

  let trails = dataset.trails;
  if (opts.only) {
    const known = new Set(trails.map((t) => t.id));
    const unknown = opts.only.filter((id) => !known.has(id));
    if (unknown.length) {
      log(`--only names trail ids that are not in the dataset: ${unknown.join(', ')}`);
      return { exitCode: 1, plans: [], failures: [], summary: null };
    }
    const only = new Set(opts.only);
    trails = trails.filter((t) => only.has(t.id));
  }
  if (opts.skipNew) trails = trails.filter((t) => !t.is_new);

  log(`Trail content — ${opts.apply ? 'APPLY' : 'DRY RUN (nothing will be changed)'}`);
  log(`Target:  ${new URL(opts.supabaseUrl).host}`);
  log(`Dataset: ${dataset.trails.length} trails (${dataset.trails.filter((t) => t.is_new).length} new), generated ${dataset.generated_at ?? '?'}; in scope: ${trails.length}`);
  const flags = ['only', 'skipImages', 'skipNew', 'unpublishedNew', 'force', 'overwriteConflicts', 'updateNew'].filter((f) => opts[f]);
  if (flags.length) log(`Options: ${flags.join(', ')}`);

  // ---- read the live rows ----
  const ids = trails.map((t) => t.id);
  const live = {
    trails: await db.selectIn('trails', 'id', ids),
    checkpoints: await db.selectIn('trail_checkpoints', 'trail_id', ids),
    media: await db.selectIn('trail_media', 'trail_id', ids),
  };
  const liveTrail = new Map(live.trails.map((t) => [t.id, t]));
  const liveCps = group(live.checkpoints, 'trail_id');
  const liveMedia = group(live.media, 'trail_id');
  log(`Live:    ${live.trails.length} of these trails, ${live.checkpoints.length} checkpoints, ${live.media.length} media rows\n`);

  // ---- plan ----
  const plans = trails.map((t) =>
    planTrail(t, { trail: liveTrail.get(t.id) ?? null, checkpoints: liveCps.get(t.id) ?? [], media: liveMedia.get(t.id) ?? [] }, opts),
  );

  // ---- images: local files present? already in the bucket? ----
  let toUpload = 0;
  let uploadBytes = 0;
  let alreadyThere = 0;
  for (const plan of plans) {
    plan.problems = [];
    if (plan.trail.action === 'missing' || !plan.uploads.length) {
      plan.uploads = plan.trail.action === 'missing' ? [] : plan.uploads;
      continue;
    }
    const remote = new Map((await db.listObjects(`${STORAGE_PREFIX}/${plan.id}`)).map((o) => [o.name, o.size]));
    for (const u of plan.uploads) {
      u.localPath = path.join(imagesDir, plan.id, u.file);
      const stat = fs.existsSync(u.localPath) ? fs.statSync(u.localPath) : null;
      if (!stat) plan.problems.push(`image file missing: ${u.localPath}`);
      else if (stat.size !== u.bytes) plan.problems.push(`image ${u.localPath} is ${stat.size} bytes but the dataset says ${u.bytes} — rebuild the images or the dataset`);
      u.needed = opts.force || remote.get(u.file) !== u.bytes;
      if (u.needed) {
        toUpload++;
        uploadBytes += u.bytes;
      } else alreadyThere++;
    }
  }

  // ---- report ----
  for (const plan of plans) {
    const lines = describePlan(plan);
    const needed = plan.uploads.filter((u) => u.needed).length;
    if (needed) lines.push(`    upload ${needed} image(s) to ${BUCKET}/${STORAGE_PREFIX}/${plan.id}/`);
    for (const p of plan.problems) lines.push(`    ! ${p}`);
    if (lines.length && !/^[+~?] /.test(lines[0])) lines.unshift(`${plan.isNew ? '+' : '~'} ${plan.id}  ${plan.name}`);
    if (lines.length) log(lines.join('\n'));
  }
  const summary = summarize(plans);
  const conflicts = summary.trails.conflicts + summary.checkpoints.conflicts;
  log('\nSummary');
  log(`  trails:            insert ${summary.trails.insert}, update ${summary.trails.update}, unchanged ${summary.trails.unchanged}, not in database ${summary.trails.missing}`);
  log(`  trail fields:      ${Object.entries(summary.fields).map(([f, n]) => `${f} ${n}`).join(', ') || 'none'}`);
  log(`  cover_image_url:   set ${summary.covers.set}, cleared ${summary.covers.clear}, kept (owner upload) ${summary.covers.keep}`);
  log(`  trail_media:       insert/update ${summary.media.insert_or_update}, delete ${summary.media.delete} stock/replaced, ${summary.media.kept_untouched} other rows untouched, ${summary.media.unchanged} already correct`);
  log(`  trail_checkpoints: insert ${summary.checkpoints.insert}, update ${summary.checkpoints.update}, not in database ${summary.checkpoints.missing}`);
  log(`  storage:           upload ${toUpload} file(s) (${(uploadBytes / 1048576).toFixed(1)} MB), ${alreadyThere} already present with the same size`);
  if (conflicts) log(`  conflicts:         ${conflicts} value(s) left alone — see the lines starting with "!" above`);
  const localProblems = plans.reduce((n, p) => n + p.problems.length, 0);
  if (localProblems) log(`  local problems:    ${localProblems} — those trails will fail`);

  if (!opts.apply) {
    log('\nDry run — nothing was changed. Re-run with --apply to publish.');
    return { exitCode: localProblems ? 1 : 0, plans, failures: [], summary };
  }

  const expected = plans.filter((p) => !p.isNew);
  if (expected.length > 5 && expected.every((p) => p.trail.action === 'missing')) {
    log('\nNone of the existing trails were found in this database — wrong project? Nothing was changed.');
    return { exitCode: 1, plans, failures: [], summary };
  }

  // ---- backup, then write ----
  const todo = plans.filter((p) => p.trail.action !== 'missing' && (planHasWrites(p) || p.uploads.some((u) => u.needed)));
  if (!todo.length) {
    log('\nNothing to do — the database already matches the dataset.');
    return { exitCode: 0, plans, failures: [], summary };
  }
  const stamp = now().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(backupsDir, stamp);
  writeBackup(backupDir, live, plans, opts);
  log(`\nBackup of the live rows written to ${backupDir}`);

  const failures = [];
  let done = 0;
  for (const plan of todo) {
    let step = 'checks';
    try {
      if (plan.problems.length) throw new Error(plan.problems.join('; '));

      step = 'image upload';
      const needed = plan.uploads.filter((u) => u.needed);
      for (const u of needed) await db.uploadObject(u.storagePath, fs.readFileSync(u.localPath));
      if (needed.length) {
        const remote = new Map((await db.listObjects(`${STORAGE_PREFIX}/${plan.id}`)).map((o) => [o.name, o.size]));
        for (const u of needed) {
          if (remote.get(u.file) !== u.bytes) throw new Error(`${u.storagePath} is not in the bucket with the expected size after upload`);
        }
      }

      step = 'trail row';
      if (plan.trail.action === 'insert') await db.insertRows('trails', [plan.trail.row]);
      else if (plan.trail.action === 'update') {
        const n = await db.updateById('trails', plan.id, plan.trail.patch);
        if (n !== 1) throw new Error(`expected to update 1 trail row, updated ${n}`);
      }

      step = 'trail_media';
      if (plan.media.upsert.length) await db.upsertRows('trail_media', plan.media.upsert);
      if (plan.media.deleteIds.length) await db.deleteByIds('trail_media', plan.media.deleteIds);

      step = 'trail_checkpoints';
      if (plan.checkpoints.insert.length) await db.insertRows('trail_checkpoints', plan.checkpoints.insert);
      for (const c of plan.checkpoints.update) {
        const n = await db.updateById('trail_checkpoints', c.id, c.patch);
        if (n !== 1) throw new Error(`expected to update 1 checkpoint row (${c.id}), updated ${n}`);
      }
      done++;
    } catch (err) {
      failures.push({ id: plan.id, name: plan.name, step, error: err.message });
      log(`  FAILED ${plan.id} (${plan.name}) at ${step}: ${err.message}`);
    }
  }

  log(`\nDone: ${done} trail(s) written, ${failures.length} failed, ${plans.length - todo.length} needed no change.`);
  if (failures.length) {
    log('Failed trails (re-running is safe; finished steps are skipped):');
    for (const f of failures) log(`  ${f.id}  ${f.name} — ${f.step}: ${f.error}`);
  }
  return { exitCode: failures.length ? 1 : 0, plans, failures, summary };
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`${err.message}\n\n${HELP}`);
    return 2;
  }
  if (opts.help) {
    console.log(HELP);
    return 0;
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment. Nothing was done.');
    return 2;
  }
  try {
    new URL(supabaseUrl);
  } catch {
    console.error('SUPABASE_URL is not a valid URL. Nothing was done.');
    return 2;
  }

  const { CONTENT, IMAGES } = await import('./lib/paths.mjs');
  const datasetPath = path.resolve(opts.dataset ?? path.join(CONTENT, 'trails.json'));
  if (!fs.existsSync(datasetPath)) {
    console.error(`Dataset not found: ${datasetPath}`);
    return 2;
  }
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { exitCode } = await run({
    db: supabaseAdapter(client),
    dataset,
    opts: { ...opts, supabaseUrl },
    imagesDir: path.resolve(opts.images ?? IMAGES),
    backupsDir: path.resolve(opts.backups ?? path.join(CONTENT, 'backups')),
  });
  return exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`Stopped: ${err.message}`);
      process.exit(1);
    },
  );
}
