// Step 11 — human-readable outputs: content/REPORT.md, content/CREDITS.md and the app's bundled
// credit list mobile/assets/data/photo-credits.json.
//
//   node scripts/content/11-report.mjs
import fs from 'node:fs';
import path from 'node:path';
import { REVIEW_FLAG_CODES } from './apply-lib.mjs';
import { CACHE, CONTENT, DATA, IMAGES, REPO, WORK, latestSnapshotPath, readJson, readJsonIfExists } from './lib/paths.mjs';

const dataset = readJson(path.join(CONTENT, 'trails.json'));
const build = readJson(path.join(WORK, 'build-report.json'));
const geom = readJson(path.join(WORK, 'existing-geometry.json'));
const snapshot = readJson(latestSnapshotPath());
const budget = readJsonIfExists(path.join(CACHE, 'dem', 'budget.json'), {});
const trailById = new Map(dataset.trails.map((t) => [t.id, t]));
const existingRows = build.existing;
const short = (id) => (id.startsWith('a0000000-') ? id.slice(-3) : id.slice(0, 8));
const md = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const arrow = (a, b) => (a === b || (a == null && b == null) ? `${a ?? '–'}` : `${a ?? '–'} → **${b ?? '–'}**`);
const osmLink = (id) => `[${id}](https://www.openstreetmap.org/relation/${id})`;

// ---------- credits ----------
const credits = [];
for (const t of dataset.trails) {
  for (const p of t.photos) {
    credits.push({ trail_id: t.id, trail_name: t.name_en, file: p.file, author: p.author, license: p.license, license_url: p.license_url, source_url: p.source_url });
  }
}
fs.writeFileSync(path.join(REPO, 'mobile', 'assets', 'data', 'photo-credits.json'), `${JSON.stringify(credits, null, 2)}\n`);

const creditLines = [
  '# Photo credits',
  '',
  `Trail photos come from [Wikimedia Commons](https://commons.wikimedia.org/) and are used under the licence shown for each file (Public Domain, CC0, CC BY or CC BY-SA). ${credits.length} photos, ${new Set(credits.map((c) => c.trail_id)).size} trails.`,
  '',
  '**Changes made:** every image was downscaled (cover 960 px wide, gallery 1280 px wide), re-encoded as WebP and stripped of metadata. Nothing else was altered. Files licensed CC BY-SA are shared under the same licence.',
  '',
  'In the app each photo carries its credit in `trail_media.caption` (`Photo: <author> · <licence> · Wikimedia Commons`); the full list is bundled at `mobile/assets/data/photo-credits.json`. Map and route data © OpenStreetMap contributors (ODbL); elevation from SRTM.',
  '',
  '| Trail | Image | Author | Licence | Source |',
  '|---|---|---|---|---|',
  ...credits.map((c) => `| ${md(c.trail_name)} | \`${c.file.split('/').pop()}\` | ${md(c.author)} | ${c.license_url ? `[${c.license}](${c.license_url})` : c.license} | [Commons file page](${c.source_url}) |`),
  '',
];
fs.writeFileSync(path.join(CONTENT, 'CREDITS.md'), creditLines.join('\n'));

// ---------- numbers ----------
const existing = dataset.trails.filter((t) => !t.is_new);
const fresh = dataset.trails.filter((t) => t.is_new);
const fieldCounts = {};
for (const t of existing) for (const f of t.changed) fieldCounts[f] = (fieldCounts[f] ?? 0) + 1;
const geomList = Object.values(geom);
const rebuilt = geomList.filter((g) => g.decision === 'rebuilt');
const reversed = geomList.filter((g) => g.reversed);
const review = geomList.filter((g) => g.manual_review);
const cps = build.checkpoints;
const cpExisting = cps.filter((c) => !c.is_new);
const moved = cpExisting.filter((c) => c.changed.includes('coordinates'));
const confirmed = cpExisting.filter((c) => c.confirmed);
const unconfirmedFacilities = cpExisting.filter((c) => c.unconfirmed_facility);
const notCheckable = cpExisting.filter((c) => c.changed.includes('is_checkable') && !c.is_checkable);
const positionUnverified = cpExisting.filter((c) => c.flags.some((f) => f.startsWith('position not confirmed')));
const elevFilled = cps.filter((c) => c.changed.includes('elevation_m') || c.is_new).length;
const coverClass = { 'on-trail': 0, nearby: 0, area: 0, place: 0, none: 0 };
const allClass = { 'on-trail': 0, nearby: 0, area: 0, place: 0 };
const licenceMix = {};
for (const t of dataset.trails) {
  const cover = t.photos.find((p) => p.role === 'cover') ?? t.photos[0];
  coverClass[cover ? cover.match : 'none']++;
  for (const p of t.photos) {
    allClass[p.match]++;
    const fam = p.license.replace(/ \d.*$/, '');
    licenceMix[fam] = (licenceMix[fam] ?? 0) + 1;
  }
}
let imageBytes = 0;
let imageFiles = 0;
if (fs.existsSync(IMAGES)) {
  for (const d of fs.readdirSync(IMAGES)) {
    for (const f of fs.readdirSync(path.join(IMAGES, d))) {
      imageBytes += fs.statSync(path.join(IMAGES, d, f)).size;
      imageFiles++;
    }
  }
}
const noPhoto = dataset.trails.filter((t) => !t.photos.length);
const ownerCover = snapshot.trails.filter((t) => t.cover_image_url && !t.cover_image_url.includes('images.unsplash.com'));

// ---------- report ----------
const L = [];
L.push('# Trail catalogue re-check — report', '');
L.push(`Generated ${dataset.generated_at.slice(0, 16).replace('T', ' ')} UTC from the production snapshot \`content/snapshot/${dataset.snapshot}\` (${snapshot.trail_count} published trails, ${snapshot.checkpoint_count} checkpoints, ${snapshot.media_count} media rows, fetched ${snapshot.fetched_at.slice(0, 16).replace('T', ' ')} UTC from the public API).`, '');
L.push('Nothing has been written to production. `scripts/content/apply.mjs` publishes `content/trails.json` and `content/images/` (dry run by default).', '');

L.push('## Totals', '');
L.push(`- Existing trails re-checked: **${existing.length}**; with at least one corrected value: **${existing.filter((t) => t.changed.length).length}**.`);
L.push(`- Values changed (existing trails): ${Object.entries(fieldCounts).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(', ')}.`);
L.push(`- Routes rebuilt from OpenStreetMap: **${rebuilt.length}**; routes kept: ${geomList.length - rebuilt.length} (of which ${reversed.filter((g) => g.decision !== 'rebuilt').length} only reversed to run in the direction of the trail name); routes left for manual review: **${review.length}** (${geomList.filter((g) => !g.measurable).length} of them not measurable, so their distance/ascent/time/difficulty are unchanged and unverified).`);
L.push(`- New trails: **${fresh.length}** accepted from ${fresh.length + build.rejected.length} OSM hiking/foot relations not yet in the catalogue; ${build.rejected.length} rejected (reasons below).`);
L.push(`- Checkpoints: ${cpExisting.length} existing (${moved.length} moved, ${confirmed.length} confirmed against named OSM features, shelters/springs/camps **not** confirmable in OSM (now not checkable): ${unconfirmedFacilities.length}, ${positionUnverified.length} with an unverifiable position left in place), ${cps.length - cpExisting.length} new; elevation filled for ${elevFilled} from SRTM.`);
L.push(`- Photos: ${credits.length} real Wikimedia Commons photos for ${dataset.trails.length - noPhoto.length} of ${dataset.trails.length} trails. Cover match: on-trail ${coverClass['on-trail']}, nearby ${coverClass.nearby}, area ${coverClass.area}, place ${coverClass.place}, no photo ${coverClass.none}. All photos: on-trail ${allClass['on-trail']}, nearby ${allClass.nearby}, area ${allClass.area}, place ${allClass.place}. Licences: ${Object.entries(licenceMix).map(([k, v]) => `${k} ${v}`).join(', ')}. \`content/images\`: ${imageFiles} WebP files, ${(imageBytes / 1048576).toFixed(1)} MB.`);
L.push(`- Elevation profiles (\`elevation_profile\`, ≤ 120 [distance_m, elevation_m] points along the published route, smoothed like the ascent): **${dataset.trails.filter((t) => t.elevation_profile).length}** of ${dataset.trails.length} trails; null for the ${dataset.trails.filter((t) => !t.elevation_profile).length} trails whose route could not be measured.`);
L.push(`- Review flags (\`review_flags\`, migration 052): **${dataset.trails.filter((t) => t.review_flags.length).length}** of ${dataset.trails.length} trails carry at least one reason to look first (codes below).`);
L.push(`- OpenTopoData requests used: ${Object.entries(budget).map(([d, n]) => `${n} on ${d}`).join(', ') || '0'} (limit 1000/day). No route was left unmeasured for lack of budget.`, '');

L.push('## How the values were obtained (measured vs estimated)', '');
L.push('- **Distance** — length (haversine) of the route as stored or rebuilt, at full OSM resolution; replaced when the stored value differed by more than 10 %. It is the length of the line as drawn: most destination hikes ("X to Y Glacier", lakes) are one way, so the old hand-entered figures that were round trips now read about half. Trails whose line is an out-and-back are flagged.');
L.push('- **Ascent / descent** — SRTM 30 m (ASTER 30 m for voids) via OpenTopoData, sampled every ≤ ~120 m along the line (at most 400 samples, so long treks are sampled more coarsely), 1-2-1 smoothed, counted with a 10 m hysteresis. Replaced where the stored value was the synthetic distance × 60 / × 40 or more than 25 % off. **These are estimates**: a 30 m DEM on a line simplified to ≤ 600 points misses short ups and downs and smooths narrow ridges; real ascent is usually somewhat higher.');
L.push('- **Time** — DIN 33466 (4 km/h horizontal, 300 m/h up, 500 m/h down; the larger of horizontal and vertical time plus half the smaller), rounded to 0.5 h; walking time only, no breaks. Updated where distance or ascent changed and for all OSM-imported (synthesised) trails.');
L.push('- **Difficulty** — effort = km + ascent/100: easy < 12, medium 12–25, hard 25–45, ultra > 45, one level up when the highest point is above 3000 m. Applied to the synthesised trails (ids …100–…148); hand-curated trails kept theirs unless the formula differs by two or more levels (listed below).');
L.push('- **Region** — OSM municipality boundaries mapped to the app vocabulary (Svaneti, Tusheti, Kakheti, Kazbegi, Khevsureti, Borjomi-Kharagauli, Tbilisi, Imereti, Samegrelo, Adjara, Racha, Samtskhe-Javakheti, Kvemo Kartli, Shida Kartli, Mtskheta-Mtianeti, Guria). Changed only when the start and the middle of the route (or 80 % of it) agree on another region. Trails starting within 15 km of the Tbilisi city boundary keep or get "Tbilisi", matching how the catalogue already used it.');
L.push('- **Checkpoints** — a checkpoint whose name is a real place was looked up among named OSM features within 1.5 km of the route and moved to the route point nearest that feature. Shelters, water sources and campsites need a mapped hut / spring / camp site within 150 m of the route; otherwise they were made not checkable and are listed below. Elevations are SRTM values at the checkpoint.', '');

const FLAG_MEANING = {
  manual_review: 'the stored route could not be checked or rebuilt (broken line, no usable OSM relation) and was kept as it was; distance, ascent, time and difficulty may be unverified',
  main_line: 'recovered from a branching or broken OSM relation: the main line was picked and side or parallel ways left out',
  rebuilt: 'the route was rebuilt from OpenStreetMap, replacing the stored line',
  reversed: 'the route was turned round to run in the direction of the trail name',
  generated_name: 'the OSM relation had no name; the name was built from the OSM places at its ends',
  machine_georgian: 'Georgian text written by the pipeline (template description, name joined from OSM name:ka, or written by hand) — needs a native speaker',
  near_border: 'the route comes within 3 km of the occupation line or the state border',
  overlap: 'same name as another trail, or at least 80 % of one of the two lines runs within 100 m of the other',
  synthetic_elevation: 'elevation_gain_m is still the old synthetic distance × 60 / × 40 (the route could not be measured)',
  estimated_checkpoints: 'at least one checkpoint position could not be verified (placed by the original import at a fixed fraction of the route, or off the route)',
  unconfirmed_facility: 'a shelter, water source or campsite checkpoint has no matching OSM feature on the route (made not checkable)',
  no_photo: 'no photo at all (nothing usable on Commons and no upload by the owner)',
  area_photo: 'the cover photo was taken more than 5 km from the route, or shows a named place and has no location',
};
L.push('## Review flags (`trails.review_flags`)', '');
L.push('Short, stable codes the pipeline writes to `trails.review_flags` (migration 052) so the admin panel can show what to look at first. `apply.mjs` publishes them like any other field, against the empty array every trail has today; `reviewed_at` and `review_notes` belong to the admins and are never written. The same list is in `scripts/README.md`.', '');
L.push('| Code | Meaning | Trails |', '|---|---|---|');
for (const c of REVIEW_FLAG_CODES) {
  const list = dataset.trails.filter((t) => t.review_flags.includes(c));
  const names = list.length && list.length <= 30 ? `: ${list.map((t) => `${short(t.id)} ${md(t.name_en)}`).join('; ')}` : '';
  L.push(`| \`${c}\` | ${FLAG_MEANING[c]} | ${list.length}${names} |`);
}
L.push('');

L.push('## Every existing trail', '');
L.push('Values are old → **new**; unchanged values are shown once. Route: rebuilt / kept / reversed; **review** = needs a human (see the next sections).', '');
L.push('| id | Trail | km | ascent m | hours | difficulty | region | route | notes |');
L.push('|---|---|---|---|---|---|---|---|---|');
for (const e of existingRows) {
  const t = trailById.get(e.id);
  const g = geom[e.id];
  const routeNote = `${g.decision}${g.reversed ? ', reversed' : ''}${g.manual_review ? ', **review**' : ''}`;
  const notes = [];
  if (!g.measurable) notes.push('not measurable — values unverified');
  if (e.name !== e.name_old) notes.push(`renamed from "${md(e.name_old)}"`);
  if (t.stats?.max_m) notes.push(`max ${t.stats.max_m} m`);
  L.push(`| ${short(e.id)} | ${md(e.name)} | ${arrow(e.old.distance_km, e.new.distance_km)} | ${arrow(e.old.elevation_gain_m, e.new.elevation_gain_m)} | ${arrow(e.old.estimated_hours, e.new.estimated_hours)} | ${arrow(e.old.difficulty, e.new.difficulty)} | ${arrow(e.old.region, e.new.region)} | ${routeNote} | ${notes.join('; ')} |`);
}
L.push('');

L.push(`## Routes rebuilt from OpenStreetMap (${rebuilt.length})`, '');
L.push('Each was rebuilt by stitching the relation\'s member ways into one continuous line in travel order (gaps ≤ 150 m), then simplified with Douglas–Peucker to ≤ 600 points. Where a trail had no relation of its own, or its relation was deleted from OSM, the line is the walk between two named places along a relation that covers it — decided by hand and recorded in `scripts/content/data/geometry-overrides.json`.', '');
for (const g of rebuilt) L.push(`- **${short(g.id)} ${md(g.name)}** — ${md(g.reason)}; ${g.stored.points} → ${g.final.points} points, ${g.stored.length_km} → ${g.final.length_km} km, longest segment ${g.stored.max_segment_m} → ${g.final.max_segment_m} m.${g.flags.filter((f) => !f.startsWith('route reversed')).length ? ` ${md(g.flags.filter((f) => !f.startsWith('route reversed')).join('; '))}.` : ''}`);
L.push('');

// pairs found by the builder over all trails (the same rule sets the `overlap` review flag)
const dupes = build.overlaps ?? [];
L.push(`## Trails that overlap (${dupes.length} pairs)`, '');
L.push('Pairs with the same name, or where at least 80 % of one line lies within 100 m of the other; both trails of a pair carry the `overlap` review flag. Nothing was merged or removed; several are deliberate (a shorter stage of a longer trek, the same walk in the other direction) — decide by hand.', '');
for (const d of dupes) L.push(`- ${short(d.a)} ${md(d.a_name)}${d.a_new ? ' (new)' : ''} ↔ ${short(d.b)} ${md(d.b_name)}${d.b_new ? ' (new)' : ''}: ${Math.round(d.ab * 100)} % / ${Math.round(d.ba * 100)} % overlap${d.same_name ? ', same name' : ''}`);
L.push('');

L.push(`## Routes reversed (${reversed.length})`, '');
L.push('The line was correct but ran against the trail name (e.g. "Etseri to Bak Pass" drawn from the pass down), which turned the climb into descent. Same points, opposite order.', '');
for (const g of reversed) L.push(`- ${short(g.id)} ${md(g.name)} — ${md(g.direction.why.join('; '))}`);
L.push('');

L.push(`## Trails needing manual review (${review.length})`, '');
L.push('Their stored route was kept untouched because it could not be rebuilt without guessing. Where the route is broken (jumps, a 2-point line, a fraction of the trail) distance, ascent, time and difficulty are **unverified** and were left as they were.', '');
for (const g of review) {
  const t = trailById.get(g.id);
  L.push(`- **${short(g.id)} ${md(g.name)}** — ${md(g.flags.filter((f) => f.startsWith('manual review')).join('; ').replace(/^manual review: /, ''))}${t.flags.some((f) => /synthetic/.test(f)) ? '. Its elevation gain is still the synthetic distance × 60/40.' : ''}`);
}
L.push('');

L.push('## Difficulty changed on hand-curated trails (formula two or more levels away)', '');
for (const d of build.difficultyOverrides) L.push(`- ${short(d.id)} ${md(d.name)}: ${d.stored} → **${d.formula}** (effort ${d.effort})`);
if (!build.difficultyOverrides.length) L.push('- none');
L.push('');

L.push('## Region corrections', '');
for (const r of build.regionChanges) L.push(`- ${short(r.id)} ${md(r.name)}: ${r.from} → **${r.to}** (${r.municipalities.join(', ')})`);
L.push('');

L.push('## Names and descriptions', '');
for (const n of build.nameChanges) L.push(`- ${short(n.id)}: "${md(n.from)}" → "${md(n.to)}"`);
const manualText = existing.filter((t) => Object.values(t.provenance).some((p) => p.source === 'manual'));
for (const t of manualText) L.push(`- ${short(t.id)} ${md(t.name_en)}: corrected by hand — ${md(Object.values(t.provenance).find((p) => p.source === 'manual').note)}`);
const genDesc = existing.filter((t) => t.changed.includes('description_en'));
L.push(`- English descriptions written from the data for ${genDesc.length} trails whose description was a stub or wrong (where the trail starts and ends, distance, ascent, highest point, named OSM features within 150 m of the line). No facilities, views or safety claims were added.`);
L.push(`- Georgian names filled for ${existing.filter((t) => t.changed.includes('name_ka')).length} trails (from OSM \`name:ka\` or joined from OSM toponyms); ${existing.filter((t) => !t.name_ka).length} existing trails still have none.`, '');

L.push('## Checkpoints', '');
L.push(`### Facilities that could not be confirmed (${unconfirmedFacilities.length}) — now not checkable`, '');
L.push('No hut, spring or camp site of that kind is mapped in OpenStreetMap within 150 m of the route. Hikers must not count on these; please verify on the ground or remove them.', '');
for (const c of unconfirmedFacilities) L.push(`- **${short(c.trail)} ${md(c.trail_name)} — "${md(c.name)}" (${c.type})**`);
if (!unconfirmedFacilities.length) L.push('- none');
L.push('');
L.push(`### Moved checkpoints (${moved.length})`, '');
for (const c of moved) L.push(`- ${short(c.trail)} ${md(c.trail_name)} — "${md(c.name)}": ${md(c.provenance.coordinates?.note ?? '')}`);
L.push('');
L.push(`### Other checkpoints made not checkable (${notCheckable.filter((c) => !c.unconfirmed_facility).length})`, '');
for (const c of notCheckable.filter((x) => !x.unconfirmed_facility)) L.push(`- ${short(c.trail)} ${md(c.trail_name)} — "${md(c.name)}": ${md(c.provenance.is_checkable?.note ?? '')}`);
L.push('');
L.push(`### Positions that could not be verified (${positionUnverified.length}, left in place)`, '');
L.push('Generic labels ("Switchback Viewpoint", "Forest Bridge", "Panorama Point", …) that match no named OSM feature. They still sit on the route at the fraction of its length where the original import put them.', '');
L.push(positionUnverified.map((c) => `${short(c.trail)} "${md(c.name)}"`).join(' · '), '');

L.push(`## New trails (${fresh.length})`, '');
L.push('Accepted only if: usable name; members stitch into one continuous line (gaps ≤ 150 m); 2–120 km; entirely inside Georgian-controlled territory and at least 1 km from the occupation line (2 km for the recovered ones below); not a duplicate or variant (≥ 80 % of the line along an existing or longer new trail, or same ends ±300 m and length ±15 %); DEM data available. Ids are RFC 4122 v5 UUIDs of `osm-relation-<id>`. Values are measured/derived as above; checkpoints are Start, End and named OSM features within 150 m of the line, at their real positions.', '');
L.push('| Trail | OSM relation | region | km | ascent m | max m | hours | difficulty | checkpoints | notes |');
L.push('|---|---|---|---|---|---|---|---|---|---|');
for (const f of build.fresh) L.push(`| ${md(f.name)}${f.name_ka ? `<br>${md(f.name_ka)}` : ''} | ${osmLink(f.relation)} | ${f.region} | ${f.distance_km} | ${f.ascent} | ${f.max_m} | ${f.hours} | ${f.difficulty} | ${f.checkpoints} | ${md(f.flags.join('; '))} |`);
L.push('');

// recovered candidates: unnamed relations named after their ends, branching relations reduced to a main line
const rec = build.fresh.filter((f) => f.recovered);
const recNo = build.rejected.filter((r) => r.recovered_group);
L.push(`### Recovered candidates (${rec.length}) — please review the generated names`, '');
L.push('Second pass over two groups of rejected candidates, with every gate above applied again and a wider margin of 2 km to the occupation line:');
L.push(`- **Unnamed relations** (${rec.filter((f) => f.recovered === 'unnamed').length} recovered of ${rec.filter((f) => f.recovered === 'unnamed').length + recNo.filter((r) => r.recovered_group === 'unnamed').length}): named "Start – End" after the nearest named village, hamlet, lake, peak, pass, glacier, waterfall, hut, fortress or church within 2 km of each end ("<Place> Loop" for a loop); \`name_ka\` from the same features' Georgian names. Recorded as \`name_source: "generated"\` in the provenance.`);
L.push(`- **Branching or broken relations** (${rec.filter((f) => f.recovered === 'broken').length} recovered of ${rec.filter((f) => f.recovered === 'broken').length + recNo.filter((r) => r.recovered_group === 'broken').length}): the main line is the walk between the places named in the route name, or between the two most distant ends of its largest connected part; side branches and parallel alternatives are left out; gaps up to 300 m were joined only where both sides continue straight towards each other. The relation keeps its own name.`, '');
L.push('| Group | Name | OSM relation | km | how the line or name was made |');
L.push('|---|---|---|---|---|');
for (const f of rec) {
  const how = f.recovered === 'unnamed' ? `named after ${(f.name_from ?? []).join('; ')}` : `${f.method}; ${f.dropped_m} m of side/parallel ways left out`;
  L.push(`| ${f.recovered} | ${md(f.name)}${f.name_ka ? `<br>${md(f.name_ka)}` : ''} | ${osmLink(f.relation)} | ${f.distance_km} | ${md(how)} |`);
}
L.push('');
L.push(`Rejected again (${recNo.length}): ${Object.entries(recNo.reduce((m, r) => {
  const k = r.reason.replace(/\d+(\.\d+)?/g, 'N').replace(/"[^"]*"/g, '"…"');
  (m[k] ??= []).push(r);
  return m;
}, {})).map(([k, list]) => `${md(k)} — ${list.length} (${list.map((r) => osmLink(r.relation)).join(', ')})`).join('; ')}.`, '');
L.push(`### Rejected candidates (${build.rejected.length})`, '');
const byReason = {};
for (const r of build.rejected) {
  const key = r.reason.replace(/\d+(\.\d+)?/g, 'N').replace(/"[^"]*"/g, '"…"');
  (byReason[key] ??= []).push(r);
}
for (const [key, list] of Object.entries(byReason).sort((a, b) => b[1].length - a[1].length)) {
  L.push(`- ${md(key)} — ${list.length}: ${list.map((r) => `${osmLink(r.relation)}${r.name ? ` ${md(r.name)}` : ''}${/N/.test(key) && list.length > 1 ? ` (${md(r.reason.match(/\d+(\.\d+)?\s?(km|m|%)/)?.[0] ?? '')})` : ''}`).join(', ')}`);
}
L.push('');

L.push('## Photos', '');
L.push(`Geotagged Wikimedia Commons files were searched in a 1.5 km corridor along each route, widened to 10 km when that found fewer than four usable files. Accepted: JPEG, ≥ 1600 px wide, landscape 1.2–2.2, Public Domain / CC0 / CC BY / CC BY-SA with a named author; maps, interiors, people, plants, animals, night shots and similar were filtered by title and category, and every chosen photo was checked by eye on contact sheets (rejections are recorded in \`scripts/content/data/photo-review.json\`). One cover + up to three gallery photos per trail, at least 300 m apart. Match: on-trail ≤ 1.5 km from the route, nearby ≤ 5 km, area ≤ 10 km.`, '');
const fallbackTrails = dataset.trails.filter((t) => t.photos.some((p) => p.match === 'place' || (p.match === 'area' && p.dist_m > 10000)));
L.push(`For trails that found nothing usable within 10 km, the search was widened (\`06b-photo-places.mjs\`): geotagged files up to 25 km from the trailhead or the destination (still "area"), and photos of the named places on the route — the destination lake, peak, pass, village, fortress or protected area — found through the Wikidata items linked from OpenStreetMap or a name search checked against the item's coordinates (image P18 and Commons category P373). Those are marked "place" whatever their geotag. ${fallbackTrails.length} trails got photos this way: ${fallbackTrails.map((t) => `${short(t.id)} ${md(t.name_en)} (${[...new Set(t.photos.map((p) => (p.match === 'place' ? `place: ${p.place}` : p.match)))].join(', ')})`).join('; ')}.`, '');
const photoReview = readJsonIfExists(path.join(DATA, 'photo-review.json'), { rejected: {}, cover: {}, noPhotos: {} });
const reasons = {};
for (const why of Object.values(photoReview.rejected)) reasons[why] = (reasons[why] ?? 0) + 1;
L.push(`- Visual review: ${Object.keys(photoReview.rejected).length} automatically chosen files were rejected after looking at them (${Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} ${n}`).join(', ')}), and ${Object.keys(photoReview.cover ?? {}).length} covers were picked by hand. Most rejections were photos taken from the International Space Station or from aircraft, which Commons geotags with the ground point below them; such files are now also filtered automatically.`);
for (const [id, why] of Object.entries(photoReview.noPhotos ?? {})) L.push(`- ${short(id)} ${md(trailById.get(id)?.name_en)}: deliberately left without photos — ${md(why)}.`);
L.push(`- Trails with no suitable photo within 10 km (${noPhoto.length}; the app shows its placeholder): ${noPhoto.map((t) => `${short(t.id)} ${md(t.name_en)}`).join(', ') || 'none'}.`);
L.push(`- Owner uploads are kept: ${ownerCover.length} cover(s) on the project's storage stay as they are (${ownerCover.map((t) => short(t.id)).join(', ')}) and no photo of ours replaces them; the 10 \`trail_media\` rows on the project's storage are never touched — the apply tool only deletes rows whose URL contains \`images.unsplash.com\` (and rows it created itself).`);
L.push('- Every published photo, the cover included, gets a `trail_media` row whose caption is its credit; the cover row has sort_order 0 and exactly the URL written to `cover_image_url` (a `?v=<hash>` suffix changes when the file does), gallery rows follow with 1–3. `mobile/assets/data/photo-credits.json` lists the same photos with `file` = the stored file name (`cover.webp`, `photo-1.webp`, …).');
const over = dataset.trails.flatMap((t) => t.photos.filter((p) => p.bytes > (p.role === 'cover' ? 120 : 220) * 1024).map((p) => `${short(t.id)}/${p.file} ${Math.round(p.bytes / 1024)} KB`));
L.push(`- Size targets (cover ≤ 120 KB at 960 px, gallery ≤ 220 KB at 1280 px): ${over.length ? `${over.length} very detailed photos stay above them at WebP quality 40 (lower quality turns foliage into blotches): ${over.join(', ')}` : 'all photos meet them'}.`, '');

L.push('## Georgian text written by this pipeline — please review', '');
L.push('Toponyms come from OSM `name:ka`; joined names and the description template were assembled by the pipeline and need a native speaker\'s check.', '');
const templateCount = build.georgianAuthored.filter((g) => g.how === 'template').length;
L.push(`- Description template used for ${templateCount} trails: "მარშრუტის სიგრძეა {km} კმ. ჯამური აღმართი — დაახლოებით {ascent} მ, დაღმართი — დაახლოებით {descent} მ, უმაღლესი წერტილი — დაახლოებით {max} მ ზღვის დონიდან."`);
for (const g of build.georgianAuthored.filter((x) => x.how !== 'template')) L.push(`- ${short(g.id)} ${g.field}: **${md(g.text)}** — ${md(g.how)}`);
L.push('');

L.push('## Not done / limits', '');
L.push('- Routes flagged for manual review keep their broken geometry and unverified figures; see above.');
L.push('- SRTM-based ascent is an estimate (see method). Checkpoint elevations are DEM values, not surveyed.');
L.push('- Descriptions of hand-curated trails were not rewritten (except where they placed the trail in the wrong region); their claims about scenery or facilities were not verified.');
L.push('- Photos were judged on downscaled contact sheets; a watermark or a subtle problem may have slipped through.', '');
fs.writeFileSync(path.join(CONTENT, 'REPORT.md'), L.join('\n'));
console.log(`REPORT.md, CREDITS.md (${credits.length} photos), photo-credits.json written`);
