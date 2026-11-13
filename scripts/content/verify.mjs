// Checks the pipeline's outputs before anything is published. Exit code 1 on any problem.
//
//   node scripts/content/verify.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { REVIEW_FLAG_CODES, validateDataset } from './apply-lib.mjs';
import { haversineM, lineLengthM, maxSegmentM } from './lib/geo.mjs';
import { CONTENT, IMAGES, REPO, readJson } from './lib/paths.mjs';
import { isRfc4122, trailIdForRelation } from './lib/uuid.mjs';

const problems = [];
const warn = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
};

const raw = fs.readFileSync(path.join(CONTENT, 'trails.json'), 'utf8');
let dataset;
try {
  dataset = JSON.parse(raw);
} catch (err) {
  console.error(`content/trails.json does not parse: ${err.message}`);
  process.exit(1);
}
problems.push(...validateDataset(dataset).map((p) => `dataset: ${p}`));

const trails = dataset.trails;
check(dataset.counts.trails === trails.length, 'counts.trails does not match');
check(dataset.counts.new === trails.filter((t) => t.is_new).length, 'counts.new does not match');
check(dataset.counts.checkpoints === trails.reduce((n, t) => n + t.checkpoints.length, 0), 'counts.checkpoints does not match');
check(dataset.counts.photos === trails.reduce((n, t) => n + t.photos.length, 0), 'counts.photos does not match');

let jumps = 0;
for (const t of trails) {
  const where = `${t.id} ${t.name_en}`;
  check(t.route.length >= 2 && t.route.length <= 800, `${where}: route has ${t.route.length} points`);
  const { max } = maxSegmentM(t.route);
  if (max > 1500) {
    const flagged = t.flags.some((f) => /manual review/.test(f));
    if (!flagged) problems.push(`${where}: unflagged jump of ${Math.round(max)} m`);
    else jumps++;
  }
  check(haversineM(t.start_point, t.route[0]) < 1 && haversineM(t.end_point, t.route[t.route.length - 1]) < 1, `${where}: start/end point is not the route end`);
  if (t.is_new) {
    check(isRfc4122(t.id) && t.id === trailIdForRelation(t.osm_relation_id), `${where}: id is not uuidv5(osm-relation-${t.osm_relation_id})`);
    check(t.route.length <= 600, `${where}: more than 600 points`);
    check(t.checkpoints.length >= 2 && t.checkpoints[0].name_en && t.checkpoints.at(-1).name_en, `${where}: needs Start and End checkpoints`);
  }
  const profile = t.elevation_profile;
  if (t.stats?.ascent_m != null) {
    if (!profile) problems.push(`${where}: measured but has no elevation_profile`);
    else {
      check(Math.abs(profile[profile.length - 1][0] - lineLengthM(t.route)) <= 1, `${where}: elevation_profile does not end at the route length`);
      check(profile.length <= 120, `${where}: elevation_profile has ${profile.length} points`);
    }
  } else check(profile == null, `${where}: unmeasured trail has an elevation_profile`);
  // review flags: every trail has the array, in the canonical order, consistent with what the dataset records
  const rf = t.review_flags;
  if (!Array.isArray(rf)) problems.push(`${where}: review_flags missing`);
  else {
    const has = (c) => rf.includes(c);
    check(rf.join() === REVIEW_FLAG_CODES.filter(has).join(), `${where}: review_flags not in the canonical order`);
    check(has('generated_name') === (t.provenance?.name_en?.name_source === 'generated'), `${where}: generated_name does not match the name provenance`);
    check(has('manual_review') === t.flags.some((x) => /^manual review/.test(x)), `${where}: manual_review does not match the flags`);
    check(has('synthetic_elevation') === t.flags.some((x) => /synthetic distance/.test(x)), `${where}: synthetic_elevation does not match the flags`);
    check(!has('no_photo') || !t.photos.length, `${where}: no_photo but has photos`);
    const cover = t.photos.find((p) => p.role === 'cover');
    check(has('area_photo') === !!(cover && !(cover.dist_m != null && cover.dist_m <= 5000)), `${where}: area_photo does not match the cover distance`);
    check(!t.is_new || has('machine_georgian'), `${where}: new trail without machine_georgian (its Georgian description is a template)`);
    if (rf.length || t.is_new) check(t.changed.includes('review_flags') && Array.isArray(t.baseline?.review_flags) && !t.baseline.review_flags.length, `${where}: review_flags not published against the empty baseline`);
  }
  for (const c of t.checkpoints) {
    if (c.elevation_m == null) warn.push(`${where}: checkpoint "${c.name_en}" has no elevation`);
  }
  let covers = 0;
  for (const p of t.photos) {
    const file = path.join(IMAGES, t.id, p.file);
    if (!fs.existsSync(file)) {
      problems.push(`${where}: missing image ${file}`);
      continue;
    }
    const buf = fs.readFileSync(file);
    check(buf.length === p.bytes, `${where}: ${p.file} is ${buf.length} bytes, dataset says ${p.bytes}`);
    check(crypto.createHash('sha1').update(buf).digest('hex') === p.sha1, `${where}: ${p.file} sha1 differs from the dataset`);
    check(buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP', `${where}: ${p.file} is not WebP`);
    const limit = p.role === 'cover' ? 120 * 1024 : 220 * 1024;
    if (buf.length > limit) warn.push(`${where}: ${p.file} is ${Math.round(buf.length / 1024)} KB (target ${limit / 1024} KB)`);
    check(p.caption === `Photo: ${p.author} · ${p.license} · Wikimedia Commons` && p.author && p.license, `${where}: ${p.file} caption/credit incomplete`);
    check(['on-trail', 'nearby', 'area', 'place'].includes(p.match), `${where}: ${p.file} has no match class`);
    check(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(p.source_url ?? ''), `${where}: ${p.file} source_url is not a Commons file page`);
    if (p.role === 'cover') covers++;
  }
  check(covers <= 1, `${where}: ${covers} covers`);
}
// image folder has nothing the dataset does not know about
if (fs.existsSync(IMAGES)) {
  for (const d of fs.readdirSync(IMAGES)) {
    const t = trails.find((x) => x.id === d);
    for (const f of fs.readdirSync(path.join(IMAGES, d))) {
      if (!t?.photos.some((p) => p.file === f)) warn.push(`content/images/${d}/${f} is not referenced by the dataset (not published)`);
    }
  }
}

// credits file matches the dataset
const credits = readJson(path.join(REPO, 'mobile', 'assets', 'data', 'photo-credits.json'));
const photoCount = trails.reduce((n, t) => n + t.photos.length, 0);
check(Array.isArray(credits) && credits.length === photoCount, `photo-credits.json has ${credits.length} entries, dataset has ${photoCount} photos`);
for (const c of credits) {
  const t = trails.find((x) => x.id === c.trail_id);
  check(t && t.photos.some((p) => p.file === c.file && p.author === c.author && p.license === c.license), `photo-credits.json entry ${c.trail_id}/${c.file} does not match the dataset`);
}

// seed: no destructive or fake content, same catalogue
const seed = fs.readFileSync(path.join(REPO, 'supabase', 'seed.sql'), 'utf8');
check(!/\bTRUNCATE\b|\bDELETE\s+FROM\b/i.test(seed), 'seed.sql deletes data');
check(!/\b(profiles|auth\.users|trail_reviews|trail_completions|checkpoint_completions|trail_conditions)\b/i.test(seed), 'seed.sql creates users, reviews, completions or conditions');
check(!/supabase\.co/i.test(seed), 'seed.sql points at a Supabase project');
check((seed.match(/^INSERT INTO trails /gm) ?? []).length === trails.length, 'seed.sql trail count differs from the dataset');
const products = fs.readFileSync(path.join(REPO, 'supabase', 'seed_products.sql'), 'utf8');
check(!/\bDELETE\s+FROM\b/i.test(products) && /ON CONFLICT \(id\) DO UPDATE/.test(products), 'seed_products.sql is not an idempotent upsert');

// report numbers
const report = fs.readFileSync(path.join(CONTENT, 'REPORT.md'), 'utf8');
check(report.includes(`Existing trails re-checked: **${trails.filter((t) => !t.is_new).length}**`), 'REPORT.md existing count differs');
check(report.includes(`New trails: **${trails.filter((t) => t.is_new).length}**`), 'REPORT.md new-trail count differs');
check(report.includes(`${photoCount} real Wikimedia Commons photos`), 'REPORT.md photo count differs');

for (const w of warn) console.log(`warning: ${w}`);
for (const p of problems) console.log(`PROBLEM: ${p}`);
const flagCounts = REVIEW_FLAG_CODES.map((c) => `${c} ${trails.filter((t) => t.review_flags?.includes(c)).length}`).join(', ');
console.log(`review_flags: ${flagCounts}`);
console.log(`verify: ${trails.length} trails (${trails.filter((t) => t.is_new).length} new), ${trails.filter((t) => t.elevation_profile).length} with an elevation profile, ${photoCount} photos, ${jumps} flagged routes with jumps; ${problems.length} problems, ${warn.length} warnings`);
process.exit(problems.length ? 1 : 0);
