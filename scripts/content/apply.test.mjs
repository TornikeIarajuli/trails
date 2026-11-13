// node --test scripts/content/  — pure parts of the apply tool plus a full run against an in-memory fake.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  STORAGE_PREFIX, describePlan, matchesSignature, parseArgs, planHasWrites, planTrail, publicUrl, routeSignature,
  summarize, validateDataset, valuesEqual,
} from './apply-lib.mjs';
import { run } from './apply.mjs';
import { geoJsonCoords, lineEwkt, pointEwkt } from './lib/ewkt.mjs';
import { dinHours, difficultyFor, ascentDescent, roundHours } from './lib/hiking.mjs';
import { isRfc4122, trailIdForRelation, uuidv5 } from './lib/uuid.mjs';
import { stitchWays } from './lib/stitch.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SUPA = 'https://example.supabase.co';
const T1 = 'a0000000-0000-0000-0000-000000000001';
const T2 = 'a0000000-0000-0000-0000-000000000002';
const NEW = trailIdForRelation(123456);
const CP1 = '74b062fb-79a9-43ea-8d0f-9c3fb62c71ee';
const CP2 = '84b062fb-79a9-43ea-8d0f-9c3fb62c71ee';

const geo = (type, coordinates) => ({ type, crs: { type: 'name', properties: { name: 'EPSG:4326' } }, coordinates });
const oldRoute = [[44.6, 42.6], [44.61, 42.61], [44.62, 42.62]];
const newRoute = [[44.6, 42.6], [44.605, 42.605], [44.61, 42.61], [44.62, 42.62]];

function photo(id, file, role) {
  return {
    file, role, path: `${STORAGE_PREFIX}/${id}/${file}`, caption: 'Photo: Jane Doe · CC BY-SA 4.0 · Wikimedia Commons',
    match: 'on-trail', author: 'Jane Doe', license: 'CC BY-SA 4.0', bytes: 5, sha1: 'abcdef0123456789',
  };
}

function dataset() {
  return {
    generated_at: '2026-11-13T00:00:00Z',
    trails: [
      {
        id: T1, is_new: false, name_en: 'Gergeti', name_ka: 'გერგეტი', description_en: 'd', description_ka: null,
        difficulty: 'easy', region: 'Kazbegi', distance_km: 5.4, elevation_gain_m: 640, estimated_hours: 3, start_address: null,
        route: newRoute, start_point: newRoute[0], end_point: newRoute[3],
        changed: ['distance_km', 'elevation_gain_m', 'route'],
        baseline: { distance_km: 6, elevation_gain_m: 500, route: routeSignature(oldRoute) },
        checkpoints: [
          { id: CP1, name_en: 'Start', name_ka: null, type: 'landmark', coordinates: newRoute[0], elevation_m: 1750, sort_order: 0, is_checkable: true, changed: ['elevation_m'], baseline: { elevation_m: null } },
          { id: CP2, name_en: 'Forest Camp', name_ka: null, type: 'campsite', coordinates: newRoute[2], elevation_m: 1900, sort_order: 1, is_checkable: false, changed: ['elevation_m', 'is_checkable'], baseline: { elevation_m: null, is_checkable: true } },
        ],
        photos: [photo(T1, 'cover.webp', 'cover'), photo(T1, 'photo-1.webp', 'gallery')],
      },
      {
        id: T2, is_new: false, name_en: 'Owner trail', name_ka: null, description_en: null, description_ka: null,
        difficulty: 'hard', region: 'Svaneti', distance_km: 10, elevation_gain_m: 900, estimated_hours: 5, start_address: null,
        route: oldRoute, start_point: oldRoute[0], end_point: oldRoute[2],
        changed: ['region'], baseline: { region: 'Tusheti' }, checkpoints: [], photos: [photo(T2, 'cover.webp', 'cover'), photo(T2, 'photo-1.webp', 'gallery')],
      },
      {
        id: NEW, is_new: true, osm_relation_id: 123456, name_en: 'New trail', name_ka: null, description_en: 'x', description_ka: null,
        difficulty: 'medium', region: 'Racha', distance_km: 12.3, elevation_gain_m: 700, estimated_hours: 5.5, start_address: null,
        route: newRoute, start_point: newRoute[0], end_point: newRoute[3],
        changed: ['name_en'], baseline: {},
        checkpoints: [{ id: uuidv5('cp-new-start'), name_en: 'Start', name_ka: null, type: 'landmark', coordinates: newRoute[0], elevation_m: 1200, sort_order: 0, is_checkable: true, changed: [], baseline: {} }],
        photos: [photo(NEW, 'cover.webp', 'cover')],
      },
    ],
  };
}

function liveRows() {
  return {
    trails: [
      {
        id: T1, name_en: 'Gergeti', name_ka: 'გერგეტი', description_en: 'd', description_ka: null, difficulty: 'easy', region: 'Kazbegi',
        distance_km: 6, elevation_gain_m: 500, estimated_hours: 3, start_address: null, route: geo('LineString', oldRoute),
        start_point: geo('Point', oldRoute[0]), end_point: geo('Point', oldRoute[2]),
        cover_image_url: 'https://images.unsplash.com/photo-1?w=800', is_published: true,
      },
      {
        id: T2, name_en: 'Owner trail', name_ka: null, description_en: null, description_ka: null, difficulty: 'hard', region: 'Tusheti',
        distance_km: 10, elevation_gain_m: 900, estimated_hours: 5, start_address: null, route: geo('LineString', oldRoute),
        start_point: geo('Point', oldRoute[0]), end_point: geo('Point', oldRoute[2]),
        cover_image_url: `${SUPA}/storage/v1/object/public/trail-media/covers/${T2}/own.jpg`, is_published: true,
      },
    ],
    trail_checkpoints: [
      { id: CP1, trail_id: T1, name_en: 'Start', name_ka: null, description_en: null, description_ka: null, type: 'landmark', coordinates: geo('Point', oldRoute[0]), elevation_m: null, sort_order: 0, is_checkable: true },
      { id: CP2, trail_id: T1, name_en: 'Forest Camp', name_ka: null, description_en: null, description_ka: null, type: 'campsite', coordinates: geo('Point', oldRoute[1]), elevation_m: null, sort_order: 1, is_checkable: true },
    ],
    trail_media: [
      { id: 'm1', trail_id: T1, type: 'photo', url: 'https://images.unsplash.com/photo-1?w=600', caption: 'Gergeti - Photo 1', sort_order: 0 },
      { id: 'm2', trail_id: T1, type: 'photo', url: `${SUPA}/storage/v1/object/public/trail-media/trails/${T1}/real.jpeg`, caption: null, sort_order: 3 },
      { id: 'm3', trail_id: T2, type: 'photo', url: 'https://images.unsplash.com/photo-2?w=600', caption: 'x', sort_order: 0 },
    ],
  };
}

// EWKT → the GeoJSON PostgREST would return, so the fake behaves like the real thing on read-back.
function ewktToGeo(v) {
  if (typeof v !== 'string' || !v.startsWith('SRID=4326;')) return v;
  const body = v.slice('SRID=4326;'.length);
  const nums = (s) => s.split(',').map((p) => p.trim().split(/\s+/).map(Number));
  if (body.startsWith('POINT(')) return geo('Point', nums(body.slice(6, -1))[0]);
  if (body.startsWith('LINESTRING(')) return geo('LineString', nums(body.slice(11, -1)));
  throw new Error(`bad EWKT ${v}`);
}

function fakeDb(rows, { failUpdateFor = null } = {}) {
  const tables = structuredClone(rows);
  const storage = new Map();
  const writes = [];
  const conv = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, ewktToGeo(v)]));
  return {
    tables, storage, writes,
    async selectIn(table, column, ids) {
      return structuredClone(tables[table].filter((r) => ids.includes(r[column])));
    },
    async insertRows(table, list) {
      writes.push(['insert', table, list.length]);
      for (const r of list) {
        if (tables[table].some((x) => x.id === r.id)) throw new Error(`duplicate key ${r.id}`);
        tables[table].push(conv(r));
      }
    },
    async upsertRows(table, list) {
      writes.push(['upsert', table, list.length]);
      for (const r of list) {
        const i = tables[table].findIndex((x) => x.id === r.id);
        if (i >= 0) tables[table][i] = { ...tables[table][i], ...conv(r) };
        else tables[table].push(conv(r));
      }
    },
    async updateById(table, id, patch) {
      writes.push(['update', table, id]);
      if (failUpdateFor === id) throw new Error('simulated failure');
      const r = tables[table].find((x) => x.id === id);
      if (!r) return 0;
      Object.assign(r, conv(patch));
      return 1;
    },
    async deleteByIds(table, ids) {
      writes.push(['delete', table, ids.length]);
      const before = tables[table].length;
      tables[table] = tables[table].filter((r) => !ids.includes(r.id));
      return before - tables[table].length;
    },
    async listObjects(prefix) {
      return [...storage.entries()].filter(([k]) => k.startsWith(`${prefix}/`)).map(([k, size]) => ({ name: k.slice(prefix.length + 1), size }));
    },
    async uploadObject(p, buf) {
      writes.push(['upload', p]);
      storage.set(p, buf.length);
    },
  };
}

function tempDirs(ds) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trail-apply-'));
  const images = path.join(root, 'images');
  for (const t of ds.trails) {
    fs.mkdirSync(path.join(images, t.id), { recursive: true });
    for (const p of t.photos) fs.writeFileSync(path.join(images, t.id, p.file), Buffer.from('12345'));
  }
  return { root, images, backups: path.join(root, 'backups') };
}

const baseOpts = (extra = {}) => ({ ...parseArgs([]), supabaseUrl: SUPA, ...extra });

// ---------- pure helpers ----------

test('EWKT builders produce PostGIS-readable strings', () => {
  assert.equal(pointEwkt([44.6145986, 42.6654914]), 'SRID=4326;POINT(44.6145986 42.6654914)');
  assert.equal(lineEwkt([[44.1, 42.1], [44.12345678, 42.2]]), 'SRID=4326;LINESTRING(44.1 42.1,44.1234568 42.2)');
  assert.equal(pointEwkt([1e-8, 42]), 'SRID=4326;POINT(0 42)');
  assert.throws(() => lineEwkt([[44, 42]]), /at least 2/);
  assert.throws(() => pointEwkt([200, 42]), /out of range/);
  assert.throws(() => pointEwkt([Number.NaN, 42]), /Invalid/);
  assert.deepEqual(geoJsonCoords(geo('Point', [1, 2])), [1, 2]);
  assert.deepEqual(geoJsonCoords('{"type":"Point","coordinates":[3,4]}'), [3, 4]);
});

test('parseArgs reads flags and validates --only', () => {
  const o = parseArgs(['--apply', '--only', `${T1},${T2}`, '--skip-images', '--unpublished-new']);
  assert.equal(o.apply, true);
  assert.deepEqual(o.only, [T1, T2]);
  assert.equal(o.skipImages, true);
  assert.equal(o.unpublishedNew, true);
  assert.equal(parseArgs([]).apply, false);
  assert.throws(() => parseArgs(['--only', 'abc']), /trail ids/);
  assert.throws(() => parseArgs(['--only']), /needs a value/);
  assert.throws(() => parseArgs(['--wat']), /Unknown argument/);
});

test('route signatures tolerate float noise but not a different line', () => {
  const sig = routeSignature(oldRoute);
  assert.ok(matchesSignature(oldRoute.map(([x, y]) => [x + 1e-9, y]), sig));
  assert.ok(!matchesSignature(newRoute, sig));
  assert.ok(valuesEqual('distance_km', 6, '6.00'));
  assert.ok(!valuesEqual('name_ka', null, 'x'));
});

test('validateDataset accepts the fixture and rejects broken records', () => {
  assert.deepEqual(validateDataset(dataset()), []);
  const ds = dataset();
  ds.trails[0].changed.push('cover_image_url');
  ds.trails[0].photos[0].caption = 'nice photo';
  ds.trails[1].id = 'not-an-id';
  ds.trails[2].distance_km = 12.345;
  delete ds.trails[0].baseline.distance_km;
  const problems = validateDataset(ds).join('\n');
  assert.match(problems, /cover_image_url is not publishable/);
  assert.match(problems, /caption is not a credit line/);
  assert.match(problems, /invalid id/);
  assert.match(problems, /numeric\(6,2\)/);
  assert.match(problems, /no baseline for changed field distance_km/);
});

test('uuid v5 ids are deterministic and RFC 4122', () => {
  assert.equal(trailIdForRelation(42), trailIdForRelation(42));
  assert.notEqual(trailIdForRelation(42), trailIdForRelation(43));
  assert.ok(isRfc4122(trailIdForRelation(42)));
  // RFC 4122 appendix vector: uuidv5('www.example.com', DNS namespace)
  assert.equal(uuidv5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'), '2ed6657d-e927-568b-95e1-2665a8aea6a2');
});

test('hiking maths: hysteresis, DIN 33466, difficulty', () => {
  assert.deepEqual(ascentDescent([100, 105, 100, 106, 101, 150, 140, 200], 10), { ascent: 110, descent: 10 }); // ripple under 10 m ignored
  assert.equal(dinHours(12, 0, 0), 3);
  assert.equal(roundHours(dinHours(10, 900, 900)), 6); // vertical 4.8 h + horizontal 2.5 h / 2
  assert.equal(difficultyFor(8, 300, 2000).difficulty, 'easy');
  assert.equal(difficultyFor(8, 300, 3100).difficulty, 'medium');
  assert.equal(difficultyFor(30, 2000, 2500).difficulty, 'ultra');
});

test('stitchWays orders and flips ways and refuses real gaps', () => {
  const a = { id: 1, coords: [[44, 42], [44.001, 42]] };
  const b = { id: 2, coords: [[44.002, 42], [44.001, 42]] }; // reversed, shares a node with a
  const r = stitchWays([b, a]);
  assert.ok(r.ok);
  assert.equal(r.coords.length, 3);
  const far = { id: 3, coords: [[44.05, 42], [44.06, 42]] };
  assert.equal(stitchWays([a, far]).ok, false);
});

// ---------- planning ----------

test('planTrail updates only managed fields whose live value is still the baseline', () => {
  const live = liveRows();
  const ds = dataset();
  const plan = planTrail(ds.trails[0], { trail: live.trails[0], checkpoints: live.trail_checkpoints, media: live.trail_media.filter((m) => m.trail_id === T1) }, baseOpts());
  assert.equal(plan.trail.action, 'update');
  assert.deepEqual(Object.keys(plan.trail.patch).sort(), ['cover_image_url', 'distance_km', 'elevation_gain_m', 'route']);
  assert.match(plan.trail.patch.route, /^SRID=4326;LINESTRING\(44\.6 42\.6,44\.605 42\.605/);
  assert.equal(plan.trail.patch.cover_image_url, publicUrl(SUPA, `${STORAGE_PREFIX}/${T1}/cover.webp`, 'abcdef01'));
  assert.deepEqual(plan.media.deleteIds, ['m1']); // stock row only; the owner's upload m2 stays
  assert.equal(plan.media.kept, 1);
  // the cover gets its own media row (sort_order 0) with exactly the cover_image_url, gallery after it
  assert.deepEqual(plan.media.upsert.map((r) => r.sort_order), [0, 1]);
  assert.equal(plan.media.upsert[0].url, plan.trail.patch.cover_image_url);
  assert.equal(plan.media.upsert[0].caption, 'Photo: Jane Doe · CC BY-SA 4.0 · Wikimedia Commons');
  assert.equal(plan.checkpoints.update.length, 2);
  assert.deepEqual(Object.keys(plan.checkpoints.update[1].patch).sort(), ['elevation_m', 'is_checkable']);
});

test('planTrail leaves values alone that changed live since the snapshot', () => {
  const live = liveRows();
  live.trails[0].distance_km = 7.5; // edited in the admin panel after the snapshot
  const plan = planTrail(dataset().trails[0], { trail: live.trails[0], checkpoints: [], media: [] }, baseOpts());
  assert.ok(!('distance_km' in plan.trail.patch));
  assert.equal(plan.trail.conflicts[0].field, 'distance_km');
  const forced = planTrail(dataset().trails[0], { trail: live.trails[0], checkpoints: [], media: [] }, baseOpts({ overwriteConflicts: true }));
  assert.equal(forced.trail.patch.distance_km, 5.4);
});

test('an owner-uploaded cover is kept; no real photo clears a stock cover', () => {
  const live = liveRows();
  const p2 = planTrail(dataset().trails[1], { trail: live.trails[1], checkpoints: [], media: live.trail_media.filter((m) => m.trail_id === T2) }, baseOpts());
  assert.equal(p2.cover.action, 'keep');
  assert.ok(!('cover_image_url' in (p2.trail.patch ?? {})));
  assert.deepEqual(p2.media.deleteIds, ['m3']);
  // the owner's cover stays, so our cover is neither uploaded nor given a media row
  assert.deepEqual(p2.media.upsert.map((r) => [r.url.split('/').pop(), r.sort_order]), [['photo-1.webp?v=abcdef01', 1]]);
  assert.deepEqual(p2.uploads.map((u) => u.file), ['photo-1.webp']);
  const t1 = dataset().trails[0];
  t1.photos = [];
  const p1 = planTrail(t1, { trail: live.trails[0], checkpoints: [], media: [] }, baseOpts());
  assert.equal(p1.cover.action, 'clear');
  assert.equal(p1.trail.patch.cover_image_url, null);
  const skip = planTrail(dataset().trails[0], { trail: live.trails[0], checkpoints: [], media: live.trail_media }, baseOpts({ skipImages: true }));
  assert.equal(skip.cover.action, 'none');
  assert.equal(skip.media.deleteIds.length, 0);
});

test('new trails are inserted (published unless asked otherwise) and never overwritten silently', () => {
  const ds = dataset();
  const ins = planTrail(ds.trails[2], { trail: null, checkpoints: [], media: [] }, baseOpts());
  assert.equal(ins.trail.action, 'insert');
  assert.equal(ins.trail.row.is_published, true);
  assert.equal(ins.checkpoints.insert.length, 1);
  assert.equal(planTrail(ds.trails[2], { trail: null, checkpoints: [], media: [] }, baseOpts({ unpublishedNew: true })).trail.row.is_published, false);
  const existingRow = { ...ins.trail.row, name_en: 'Renamed by owner', route: geo('LineString', newRoute), start_point: geo('Point', newRoute[0]), end_point: geo('Point', newRoute[3]) };
  const again = planTrail(ds.trails[2], { trail: existingRow, checkpoints: [], media: [] }, baseOpts());
  assert.equal(again.trail.conflicts.length, 1);
  assert.equal(again.trail.action, 'none');
});

test('a trail that disappeared from the database is reported, not recreated', () => {
  const plan = planTrail(dataset().trails[0], { trail: null, checkpoints: [], media: [] }, baseOpts());
  assert.equal(plan.trail.action, 'missing');
  assert.equal(planHasWrites(plan), false);
  assert.match(describePlan(plan).join('\n'), /not in the database/);
});

// ---------- full runs against the fake ----------

test('dry run reads but never writes', async () => {
  const ds = dataset();
  const dirs = tempDirs(ds);
  const db = fakeDb(liveRows());
  const logs = [];
  const res = await run({ db, dataset: ds, opts: baseOpts(), imagesDir: dirs.images, backupsDir: dirs.backups, log: (l) => logs.push(l) });
  assert.equal(res.exitCode, 0);
  assert.deepEqual(db.writes, []);
  assert.ok(!fs.existsSync(dirs.backups));
  const out = logs.join('\n');
  assert.match(out, /DRY RUN/);
  assert.match(out, /distance_km: 6 -> 5\.4/);
  assert.match(out, /trails:\s+insert 1, update 2/);
  const s = summarize(res.plans);
  assert.equal(s.media.delete, 2);
});

test('apply writes, backs up first, and a second run has nothing to do', async () => {
  const ds = dataset();
  const dirs = tempDirs(ds);
  const db = fakeDb(liveRows());
  const res = await run({ db, dataset: ds, opts: baseOpts({ apply: true }), imagesDir: dirs.images, backupsDir: dirs.backups, log: () => {}, now: () => new Date('2026-11-13T10:00:00Z') });
  assert.equal(res.exitCode, 0, JSON.stringify(res.failures));
  const backup = path.join(dirs.backups, '2026-11-13T10-00-00-000Z');
  for (const f of ['trails.json', 'trail_routes.json', 'trail_checkpoints.json', 'trail_media.json', 'plan.json']) assert.ok(fs.existsSync(path.join(backup, f)), f);
  assert.ok(!('route' in JSON.parse(fs.readFileSync(path.join(backup, 'trails.json'), 'utf8'))[0]));
  const t1 = db.tables.trails.find((t) => t.id === T1);
  assert.equal(t1.distance_km, 5.4);
  assert.deepEqual(t1.route.coordinates, newRoute);
  assert.match(t1.cover_image_url, /content\/a0000000-0000-0000-0000-000000000001\/cover\.webp\?v=abcdef01$/);
  assert.equal(db.tables.trails.find((t) => t.id === T2).cover_image_url.includes('/covers/'), true);
  assert.ok(db.tables.trail_media.some((m) => m.id === 'm2'), 'owner upload kept');
  assert.ok(!db.tables.trail_media.some((m) => m.url.includes('unsplash')), 'stock rows gone');
  assert.equal(db.tables.trails.find((t) => t.id === NEW).is_published, true);
  assert.equal(db.storage.size, 4); // T1 cover + photo, T2 photo (owner cover kept), new trail cover
  const coverRow = db.tables.trail_media.find((m) => m.trail_id === T1 && m.sort_order === 0 && m.url.includes('/content/'));
  assert.equal(coverRow.url, t1.cover_image_url);
  assert.equal(db.tables.trail_checkpoints.find((c) => c.id === CP2).is_checkable, false);

  db.writes.length = 0;
  const logs = [];
  const again = await run({ db, dataset: ds, opts: baseOpts({ apply: true }), imagesDir: dirs.images, backupsDir: dirs.backups, log: (l) => logs.push(l) });
  assert.equal(again.exitCode, 0);
  assert.deepEqual(db.writes, []);
  assert.match(logs.join('\n'), /Nothing to do/);
});

test('a failing trail does not stop the others and makes the exit code non-zero', async () => {
  const ds = dataset();
  const dirs = tempDirs(ds);
  const db = fakeDb(liveRows(), { failUpdateFor: T2 });
  const res = await run({ db, dataset: ds, opts: baseOpts({ apply: true }), imagesDir: dirs.images, backupsDir: dirs.backups, log: () => {} });
  assert.equal(res.exitCode, 1);
  assert.deepEqual(res.failures.map((f) => f.id), [T2]);
  assert.equal(db.tables.trails.find((t) => t.id === T1).distance_km, 5.4);
  assert.ok(db.tables.trails.some((t) => t.id === NEW));
});

test('--only, --skip-new and missing image files are honoured', async () => {
  const ds = dataset();
  const dirs = tempDirs(ds);
  fs.rmSync(path.join(dirs.images, T1, 'photo-1.webp'));
  const db = fakeDb(liveRows());
  const res = await run({ db, dataset: ds, opts: baseOpts({ apply: true, only: [T1, NEW], skipNew: true }), imagesDir: dirs.images, backupsDir: dirs.backups, log: () => {} });
  assert.equal(res.plans.length, 1);
  assert.equal(res.exitCode, 1); // T1 fails its local image check
  assert.equal(db.tables.trails.find((t) => t.id === T1).distance_km, 6);
  assert.ok(!db.tables.trails.some((t) => t.id === NEW));
});

test('an invalid dataset is refused before anything is read', async () => {
  const ds = dataset();
  ds.trails[0].route = [[0, 0], [1, 1]];
  const db = fakeDb(liveRows());
  const logs = [];
  const res = await run({ db, dataset: ds, opts: baseOpts({ apply: true }), imagesDir: '.', backupsDir: '.', log: (l) => logs.push(l) });
  assert.equal(res.exitCode, 1);
  assert.match(logs.join('\n'), /outside Georgia/);
});

test('the CLI refuses to start without credentials in the environment', () => {
  const env = { ...process.env };
  delete env.SUPABASE_URL;
  delete env.SUPABASE_SERVICE_ROLE_KEY;
  const r = spawnSync(process.execPath, [path.join(here, 'apply.mjs')], { env, encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set/);
});
