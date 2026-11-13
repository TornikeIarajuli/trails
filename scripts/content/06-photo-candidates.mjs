// Step 6 — candidate photos from Wikimedia Commons for every trail: geotagged files in the corridor
// within 1.5 km of the route, widened to 10 km around the route when that finds too little.
// Bounding-box searches on a fixed grid keep the number of requests low and let trails share them.
// Output: content/work/photo-candidates.json { files: { title: info }, trails: { id: [{ title, coord, dist_m }] } }
//
//   node scripts/content/06-photo-candidates.mjs [--only <id,…>]
import path from 'node:path';
import { acceptedLicence, authorOf, fileInfo, geosearchBox, stripHtml } from './lib/commons.mjs';
import { LineIndex, sampleAlong } from './lib/geo.mjs';
import { WORK, readJson, readJsonIfExists, writeJson } from './lib/paths.mjs';

const existing = readJson(path.join(WORK, 'existing-geometry.json'));
const { accepted } = readJsonIfExists(path.join(WORK, 'new-geometry.json'), { accepted: [] });
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg > 0 ? new Set(process.argv[onlyArg + 1].split(',')) : null;

const TILE_LAT = 0.15;
const TILE_LNG = 0.2;
const PER_TRAIL = 150;
const BAD_TITLE = /\b(map|karte|carte|plan|scheme|schema|diagram|logo|coat of arms|emblem|flag|icon|ikona|fresco|mural|inscription|interior|inside|museum|exhibit|document|letter|stamp|coin|banknote|portrait|selfie|wedding|concert|festival|night|nacht|macro|close ?up|flower|blossom|insect|butterfly|beetle|bird|lizard|snake|spider|moth|fungus|mushroom|orchid|plant|leaf|seed|cow|sheep|dog|cat|horse|food|dish|meal|wine|khachapuri|sign|signboard|poster|ticket|screenshot|drawing|painting|sketch|book|page|scan|svg)\b/i;
const titleOk = (title) => /\.jpe?g$/i.test(title) && !BAD_TITLE.test(title.replace(/[_\-.,()]/g, ' '));

const trails = [
  ...Object.values(existing).map((e) => ({ id: e.id, name: e.name, line: e.route })),
  ...accepted.map((a) => ({ id: a.id, name: a.name_en, line: a.route })),
].filter((t) => !only || only.has(t.id));

/** Grid tiles (aligned, so neighbouring trails share them) that the points fall into, padded. */
function tilesFor(points, padLat, padLng) {
  const keys = new Set();
  for (const [lng, lat] of points) {
    for (const dy of [-padLat, 0, padLat])
      for (const dx of [-padLng, 0, padLng]) keys.add(`${Math.floor((lng + dx) / TILE_LNG)},${Math.floor((lat + dy) / TILE_LAT)}`);
  }
  return [...keys].map((k) => {
    const [x, y] = k.split(',').map(Number);
    return [x * TILE_LNG, y * TILE_LAT, (x + 1) * TILE_LNG, (y + 1) * TILE_LAT];
  });
}

const tileCache = new Map();
async function filesInTile(box, depth = 0) {
  const key = box.map((v) => v.toFixed(4)).join(',');
  if (tileCache.has(key)) return tileCache.get(key);
  let list = await geosearchBox(box, 500);
  if (list.length >= 500 && depth < 3) {
    // dense area: split into four and search again
    const [x0, y0, x1, y1] = box;
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    list = [];
    for (const b of [[x0, y0, mx, my], [mx, y0, x1, my], [x0, my, mx, y1], [mx, my, x1, y1]]) list.push(...(await filesInTile(b, depth + 1)));
  }
  tileCache.set(key, list);
  return list;
}

async function collect(t, maxM, points, padLat, padLng) {
  const index = new LineIndex(t.line);
  const seen = new Map();
  for (const box of tilesFor(points, padLat, padLng)) {
    for (const f of await filesInTile(box)) {
      if (seen.has(f.title) || !titleOk(f.title)) continue;
      const d = index.distanceWithin(f.coord, maxM);
      if (d !== Infinity) seen.set(f.title, { title: f.title, coord: f.coord, dist_m: Math.round(d) });
    }
  }
  return [...seen.values()].sort((a, b) => a.dist_m - b.dist_m);
}

const out = readJsonIfExists(path.join(WORK, 'photo-candidates.json'), { files: {}, trails: {} });
const usable = (f) => f && f.licence && f.author && f.mime === 'image/jpeg' && f.width >= 1600 && f.width / f.height >= 1.2 && f.width / f.height <= 2.2;

async function describeFiles(titles) {
  const todo = [...new Set(titles)].filter((t) => !out.files[t]);
  if (!todo.length) return;
  const info = await fileInfo(todo);
  for (const title of todo) {
    const f = info.get(title);
    if (!f) {
      out.files[title] = { title, missing: true };
      continue;
    }
    out.files[title] = {
      title,
      width: f.width,
      height: f.height,
      mime: f.mime,
      url: f.url,
      thumburl: f.thumburl,
      thumbwidth: f.thumbwidth,
      page: f.descriptionurl,
      licence: acceptedLicence(f.meta),
      licence_raw: stripHtml(f.meta.LicenseShortName ?? f.meta.License ?? ''),
      author: authorOf(f.meta),
      description: stripHtml(f.meta.ImageDescription ?? f.meta.ObjectName ?? '').slice(0, 300),
      categories: String(f.meta.Categories ?? '').split('|').filter(Boolean).slice(0, 40),
      restrictions: f.meta.Restrictions ?? null,
      date: stripHtml(f.meta.DateTimeOriginal ?? '').slice(0, 20),
    };
  }
}

for (const [n, t] of trails.entries()) {
  const corridor = sampleAlong(t.line, 1000, 400).map((s) => s.p);
  let cands = (await collect(t, 1500, corridor, 0.014, 0.019)).slice(0, PER_TRAIL);
  await describeFiles(cands.map((c) => c.title));
  if (cands.filter((c) => usable(out.files[c.title])).length < 4) {
    const wide = await collect(t, 10000, corridor, 0.09, 0.12);
    cands = [...cands, ...wide.filter((w) => !cands.some((c) => c.title === w.title))].slice(0, PER_TRAIL * 2);
    await describeFiles(cands.map((c) => c.title));
  }
  out.trails[t.id] = cands;
  if ((n + 1) % 10 === 0) {
    writeJson(path.join(WORK, 'photo-candidates.json'), out);
    console.log(`  ${n + 1}/${trails.length} trails`);
  }
}
writeJson(path.join(WORK, 'photo-candidates.json'), out);
const total = Object.values(out.files).filter(usable).length;
console.log(`photo candidates: ${Object.keys(out.trails).length} trails, ${Object.keys(out.files).length} files described (${total} pass licence/author/size/aspect)`);
