#!/usr/bin/env node
// Publishes content/trails.json (+ content/images) to a Supabase project.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/content/apply.mjs            # dry run
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/content/apply.mjs --apply    # write
//   node scripts/content/apply.mjs --offline [--snapshot <file>]   # plan against content/snapshot, no keys
//
// Flags: --only <trail-id,…>  --skip-images  --skip-new  --unpublished-new  --force
//        --overwrite-conflicts  --update-new  --dataset <file>  --images <dir>  --backups <dir>
// See scripts/README.md for what each one does.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ADDED_TRAIL_COLUMNS, BUCKET, CACHE_CONTROL_SECONDS, STORAGE_PREFIX,
  describePlan, parseArgs, planHasWrites, planTrail, summarize, validateDataset,
} from './apply-lib.mjs';

const HELP = `Publishes content/trails.json and content/images to Supabase.

Environment (required, never printed): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (not for --offline)

  (no flag), --dry-run   dry run: read the live rows and print what would change
  --apply                perform the writes (backs the touched rows up first)
  --offline              dry run against the latest production snapshot in content/snapshot instead of
                         the database (no keys, no network; storage is not checked)
  --snapshot <file>      dry run against this snapshot file (implies --offline)
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

/** Offline stand-in for the database: the rows of a production snapshot (content/snapshot/*.json), read-only. */
export function snapshotAdapter(snapshot, label = 'offline snapshot') {
  // columns added after the snapshot was taken hold what their migration created them with
  const defaults = { elevation_profile: null, review_flags: [], terrain: null };
  const added = Object.keys(defaults).filter((c) => snapshot.trails.length && snapshot.trails.every((t) => !(c in t)));
  const tables = {
    trails: snapshot.trails.map(({ checkpoints, media, ...t }) => ({ ...Object.fromEntries(added.map((c) => [c, structuredClone(defaults[c])])), ...t })),
    trail_checkpoints: snapshot.trails.flatMap((t) => t.checkpoints ?? []),
    trail_media: snapshot.trails.flatMap((t) => t.media ?? []),
  };
  const refuse = async () => {
    throw new Error('offline planning never writes');
  };
  return {
    label,
    notes: [
      ...(added.length ? [`the snapshot predates ${added.map((c) => `trails.${c}`).join(', ')}; taken as ${added.map((c) => JSON.stringify(defaults[c])).join(', ')}, as the migrations created them`] : []),
      'storage is not checked offline: every photo counts as an upload',
    ],
    async selectIn(table, column, ids) {
      const want = new Set(ids);
      return structuredClone(tables[table].filter((r) => want.has(r[column])));
    },
    async listObjects() {
      return [];
    },
    insertRows: refuse, upsertRows: refuse, updateById: refuse, deleteByIds: refuse, uploadObject: refuse,
  };
}

/** The project URL the snapshot's own storage links point at (public URLs), for cover URLs in an offline plan. */
export function snapshotOrigin(snapshot) {
  for (const t of snapshot.trails) {
    for (const url of [t.cover_image_url, ...(t.media ?? []).map((m) => m.url)]) {
      if (typeof url === 'string' && url.includes('/storage/v1/object/public/')) return new URL(url).origin;
    }
  }
  return 'https://offline.invalid';
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
  log(`Target:  ${db.label ?? new URL(opts.supabaseUrl).host}`);
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
  for (const note of db.notes ?? []) log(`Note:    ${note}`);
  // columns added by later migrations must exist before anything is planned (PostgREST simply leaves them out)
  const missingColumns = Object.entries(ADDED_TRAIL_COLUMNS).filter(([c]) => live.trails.length && live.trails.every((t) => !(c in t)));
  if (missingColumns.length) {
    log(`The database has no ${missingColumns.map(([c, m]) => `trails.${c} (migration ${m})`).join(' and ')} — apply the migrations first. Nothing was done.`);
    return { exitCode: 1, plans: [], failures: [], summary: null };
  }

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
  const { CONTENT, IMAGES, latestSnapshotPath } = await import('./lib/paths.mjs');
  const datasetPath = path.resolve(opts.dataset ?? path.join(CONTENT, 'trails.json'));
  if (!fs.existsSync(datasetPath)) {
    console.error(`Dataset not found: ${datasetPath}`);
    return 2;
  }
  const imagesDir = path.resolve(opts.images ?? IMAGES);
  const backupsDir = path.resolve(opts.backups ?? path.join(CONTENT, 'backups'));

  if (opts.offline) {
    const snapshotPath = path.resolve(opts.snapshot ?? latestSnapshotPath());
    if (!fs.existsSync(snapshotPath)) {
      console.error(`Snapshot not found: ${snapshotPath}`);
      return 2;
    }
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    const { exitCode } = await run({
      db: snapshotAdapter(snapshot, `offline — snapshot ${path.basename(snapshotPath)} (fetched ${snapshot.fetched_at ?? '?'})`),
      dataset: JSON.parse(fs.readFileSync(datasetPath, 'utf8')),
      opts: { ...opts, supabaseUrl: snapshotOrigin(snapshot) },
      imagesDir,
      backupsDir,
    });
    return exitCode;
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

  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { exitCode } = await run({
    db: supabaseAdapter(client),
    dataset,
    opts: { ...opts, supabaseUrl },
    imagesDir,
    backupsDir,
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
