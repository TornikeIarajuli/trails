// Step 7 — choose, download and resize the photos: one cover + up to three gallery photos per trail
// from the Commons candidates, phone-sized WebP files, and contact sheets for a visual check.
// Inputs:  work/photo-candidates.json, data/photo-review.json (titles rejected after looking at them)
// Outputs: content/images/<trail-id>/{cover,photo-N}.webp, work/photos.json, work/sheets/*.jpg
//
//   node scripts/content/07-photos.mjs [--sheets all|changed|none]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { request } from './lib/http.mjs';
import { haversineM } from './lib/geo.mjs';
import { DATA, IMAGES, WORK, ensureDir, readJson, readJsonIfExists, writeJson } from './lib/paths.mjs';

const sheetsArg = process.argv.includes('--sheets') ? process.argv[process.argv.indexOf('--sheets') + 1] : 'changed';
const existing = readJson(path.join(WORK, 'existing-geometry.json'));
const { accepted } = readJsonIfExists(path.join(WORK, 'new-geometry.json'), { accepted: [] });
const cand = readJson(path.join(WORK, 'photo-candidates.json'));
const review = readJsonIfExists(path.join(DATA, 'photo-review.json'), { rejected: {} });
const previous = readJsonIfExists(path.join(WORK, 'photos.json'), { trails: {} });

const COVER = { width: 960, maxBytes: 120 * 1024 };
const GALLERY = { width: 1280, maxBytes: 220 * 1024 };
const MAX_PHOTOS = 4;
const MIN_APART_M = 300;

const BAD_CATEGORY = /interior|\bicons?\b|fresco|mural|\bmaps?\b|diagram|coats? of arms|logo|\bflags?\b|night|portrait|people|selfie|animals?\b|birds?\b|insects?|butterfl|flowers?\b|plants?\b|fungi|food|cuisine|museum|inscription|\bsigns?\b|signage|documents?|scans?\b|stamps?\b|vehicles?|cars?\b|buses|trucks?|aerial|satellite|drone/i;
const GOOD_CATEGORY = /landscape|mountain|valley|lake|glacier|gorge|canyon|waterfall|\bpass\b|hiking|trail|panoram|national park|forest|meadow|river|peaks?\b|ridge|caucasus/i;
const QUALITY = /quality images|featured pictures|valued images|pictures of the day/i;
const TAXA = /anisoptera|zygoptera|odonata|lepidoptera|coleoptera|hymenoptera|diptera|orthoptera|hemiptera|araneae|squamata|reptil|amphibia|mammalia|\baves\b|fungi|lichens?\b|bryophyt|(flora|fauna|plants|animals|insects|birds|spiders|butterflies|moths|mushrooms) of /i;
// photos taken from orbit or from an aircraft are geotagged with the ground point below them
const FROM_ABOVE = /\bISS\b|\biss0|international space station|astronaut|from space|expedition \d|from (the )?(air|plane|airplane|aircraft)|airplane|aircraft|in-flight|flight over|views from airplanes/i;

function usable(f) {
  if (!f || f.missing || !f.licence || !f.author || f.mime !== 'image/jpeg') return false;
  if (!(f.width >= 1600) || !f.thumburl) return false;
  const ratio = f.width / f.height;
  if (ratio < 1.2 || ratio > 2.2) return false;
  if (review.rejected[f.title]) return false;
  if (f.categories.some((c) => BAD_CATEGORY.test(c) || FROM_ABOVE.test(c))) return false;
  if (FROM_ABOVE.test(f.title.replace(/[_\-.,()]/g, ' '))) return false;
  // species photos: taxon categories, or a title that starts with the Latin name it is filed under
  if (f.categories.some((c) => TAXA.test(c))) return false;
  const binomial = f.title.match(/^File:([A-Z][a-z]+ [a-z]{4,})\b/)?.[1];
  if (binomial && f.categories.includes(binomial)) return false;
  return true;
}

const matchOf = (d) => (d <= 1500 ? 'on-trail' : d <= 5000 ? 'nearby' : d <= 10000 ? 'area' : null);

function score(c, f) {
  const cls = c.dist_m <= 1500 ? 3 : c.dist_m <= 5000 ? 2 : 1;
  let s = cls * 10 - c.dist_m / 1500;
  s += Math.min(f.width, 4000) / 8000;
  if (f.categories.some((x) => GOOD_CATEGORY.test(x))) s += 0.6;
  if (f.categories.some((x) => QUALITY.test(x))) s += 0.8;
  return s;
}

const trails = [
  ...Object.values(existing).map((e) => ({ id: e.id, name: e.name })),
  ...accepted.map((a) => ({ id: a.id, name: a.name_en })),
];

const used = new Map(); // title -> [trail ids]
const selection = {};
for (const t of trails) {
  const list = (cand.trails[t.id] ?? [])
    .map((c) => ({ c, f: cand.files[c.title] }))
    .filter(({ c, f }) => usable(f) && matchOf(c.dist_m))
    .map(({ c, f }) => {
      let s = score(c, f);
      const others = used.get(c.title) ?? [];
      if (others.length) s -= c.dist_m <= 1500 ? 5 : 100; // the same file twice only for a genuinely shared place
      return { c, f, s };
    })
    .filter((x) => x.s > -50)
    .sort((a, b) => b.s - a.s);
  // a cover picked by hand after looking at the contact sheets goes first
  const pinned = review.cover?.[t.id];
  if (pinned) {
    const i = list.findIndex((x) => x.c.title === pinned);
    if (i > 0) list.unshift(...list.splice(i, 1));
  }
  const chosen = [];
  const perAuthor = new Map();
  if (review.noPhotos?.[t.id]) list.length = 0;
  for (const x of list) {
    if (chosen.length >= (review.maxPhotos?.[t.id] ?? MAX_PHOTOS)) break;
    if (chosen.some((y) => haversineM(y.c.coord, x.c.coord) < MIN_APART_M)) continue;
    const n = perAuthor.get(x.f.author) ?? 0;
    if (n >= 2) continue;
    perAuthor.set(x.f.author, n + 1);
    chosen.push(x);
  }
  // the cover is the best photo from the closest match class available
  selection[t.id] = chosen;
  for (const x of chosen) used.set(x.c.title, [...(used.get(x.c.title) ?? []), t.id]);
}

// ---------- download + resize ----------
async function encode(buf, spec) {
  const base = sharp(buf, { failOn: 'none' }).rotate().resize({ width: spec.width, withoutEnlargement: true });
  let out = null;
  // very detailed scenes (forest, scree) would need a very low quality to fit; below 40 foliage turns to
  // blotches on a phone screen, so those stay somewhat above the size target instead
  for (const q of [82, 76, 70, 64, 58, 52, 46, 40]) {
    out = await base.clone().webp({ quality: q, effort: 5 }).toBuffer({ resolveWithObject: true });
    if (out.data.length <= spec.maxBytes) return { ...out, quality: q };
  }
  return { ...out, quality: 40, over: true };
}

const photosOut = { generated_at: new Date().toISOString(), trails: {} };
let downloaded = 0;
for (const t of trails) {
  const chosen = selection[t.id];
  const dir = path.join(IMAGES, t.id);
  fs.rmSync(dir, { recursive: true, force: true });
  if (!chosen.length) {
    photosOut.trails[t.id] = [];
    continue;
  }
  ensureDir(dir);
  const rows = [];
  for (const [i, x] of chosen.entries()) {
    const role = i === 0 ? 'cover' : 'gallery';
    const file = i === 0 ? 'cover.webp' : `photo-${i}.webp`;
    const src = await request(x.f.thumburl, { as: 'buffer', bucket: 'photos', throttleKey: 'upload.wikimedia.org', minIntervalMs: 400, timeoutMs: 120_000, retries: 4 });
    downloaded++;
    const enc = await encode(src, role === 'cover' ? COVER : GALLERY);
    fs.writeFileSync(path.join(dir, file), enc.data);
    rows.push({
      file,
      role,
      title: x.f.title,
      match: matchOf(x.c.dist_m),
      dist_m: x.c.dist_m,
      author: x.f.author,
      license: x.f.licence.short,
      license_url: x.f.licence.url,
      source_url: x.f.page,
      original_url: x.f.url,
      caption: `Photo: ${x.f.author} · ${x.f.licence.short} · Wikimedia Commons`,
      width: enc.info.width,
      height: enc.info.height,
      bytes: enc.data.length,
      quality: enc.quality,
      sha1: crypto.createHash('sha1').update(enc.data).digest('hex'),
      over_size_target: !!enc.over,
    });
  }
  photosOut.trails[t.id] = rows;
}
writeJson(path.join(WORK, 'photos.json'), photosOut, true);

// ---------- contact sheets ----------
const changedIds = trails
  .map((t) => t.id)
  .filter((id) => JSON.stringify((previous.trails[id] ?? []).map((p) => p.title)) !== JSON.stringify((photosOut.trails[id] ?? []).map((p) => p.title)));
const sheetIds = sheetsArg === 'all' ? trails.map((t) => t.id) : sheetsArg === 'changed' ? changedIds : [];
const sheetDir = ensureDir(path.join(WORK, 'sheets'));
for (const f of fs.readdirSync(sheetDir)) fs.rmSync(path.join(sheetDir, f));
const TW = 300;
const TH = 200;
const LABEL = 18;
const ROWS = 6;
const withPhotos = sheetIds.filter((id) => photosOut.trails[id]?.length);
const esc = (s) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
for (let s = 0; s * ROWS < withPhotos.length; s++) {
  const ids = withPhotos.slice(s * ROWS, s * ROWS + ROWS);
  const width = TW * MAX_PHOTOS;
  const height = ids.length * (TH + LABEL);
  const comps = [];
  for (const [r, id] of ids.entries()) {
    const name = trails.find((t) => t.id === id).name;
    for (const [c, p] of photosOut.trails[id].entries()) {
      const thumb = await sharp(path.join(IMAGES, id, p.file)).resize(TW, TH, { fit: 'cover' }).jpeg({ quality: 70 }).toBuffer();
      comps.push({ input: thumb, left: c * TW, top: r * (TH + LABEL) + LABEL });
    }
    const label = `${id.slice(-12)}  ${name}`.slice(0, 90);
    const svg = `<svg width="${width}" height="${LABEL}"><rect width="100%" height="100%" fill="#222"/><text x="4" y="13" font-family="Arial, sans-serif" font-size="12" fill="#fff">${esc(label)}  —  c, 1, 2, 3 = cover, photo-1..3</text></svg>`;
    comps.push({ input: Buffer.from(svg), left: 0, top: r * (TH + LABEL) });
  }
  await sharp({ create: { width, height, channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 72 }).toFile(path.join(sheetDir, `sheet-${String(s + 1).padStart(2, '0')}.jpg`));
}

const counts = { trails: trails.length, with_photos: 0, photos: 0, 'on-trail': 0, nearby: 0, area: 0, none: 0 };
for (const t of trails) {
  const rows = photosOut.trails[t.id];
  if (!rows.length) counts.none++;
  else {
    counts.with_photos++;
    counts[rows[0].match]++;
  }
  counts.photos += rows.length;
}
const bytes = Object.values(photosOut.trails).flat().reduce((n, p) => n + p.bytes, 0);
console.log(`photos: ${JSON.stringify(counts)} (cover match class); ${downloaded} renditions used; images ${(bytes / 1048576).toFixed(1)} MB`);
console.log(`selection changed for ${changedIds.length} trails; contact sheets: ${Math.ceil(withPhotos.length / ROWS)} in ${sheetDir}`);
