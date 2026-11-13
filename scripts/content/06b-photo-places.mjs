// Step 6b — more photo candidates for the trails that got none from step 7: geotagged files up to
// 25 km from the trailhead and the destination, and photos of the named places on the route found
// through Wikidata (P18 image, P373 Commons category) — the OSM features' own wikidata tags first,
// a name search (checked against the item's coordinates) second.
// Adds to content/work/photo-candidates.json and lists the trails in its `fallback` array.
//
//   node scripts/content/06b-photo-places.mjs [--only <id,…>]
import path from 'node:path';
import { acceptedLicence, authorOf, categoryFiles, fileInfo, geosearchBox, stripHtml } from './lib/commons.mjs';
import { Features, endParts, englishLabel, labelMatches, nameParts } from './lib/features.mjs';
import { LineIndex, haversineM } from './lib/geo.mjs';
import { properTokens } from './lib/names.mjs';
import { DATA, WORK, latestSnapshotPath, readJson, readJsonIfExists, writeJson } from './lib/paths.mjs';
import { entities, search } from './lib/wikidata.mjs';

const WIDE_M = 25000;
const TILE_LAT = 0.15;
const TILE_LNG = 0.2;
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg > 0 ? new Set(process.argv[onlyArg + 1].split(',')) : null;

const snapshot = readJson(latestSnapshotPath());
const existing = readJson(path.join(WORK, 'existing-geometry.json'));
const { accepted } = readJson(path.join(WORK, 'new-geometry.json'));
const photos = readJson(path.join(WORK, 'photos.json')).trails;
const cand = readJson(path.join(WORK, 'photo-candidates.json'));
const features = new Features(readJson(path.join(WORK, 'osm-pois.json')).pois);
// hand-set place lookups, e.g. when the stored route is not where the trail really is
const placeSearch = readJsonIfExists(path.join(DATA, 'photo-review.json'), {}).placeSearch ?? {};
const BAD_TITLE = /\b(map|karte|carte|plan|scheme|diagram|logo|coat of arms|emblem|flag|icon|fresco|mural|inscription|interior|inside|museum|document|stamp|coin|portrait|selfie|night|macro|close ?up|flower|insect|butterfly|bird|lizard|snake|spider|fungus|mushroom|plant|leaf|food|sign|poster|screenshot|drawing|painting|book|scan|svg)\b/i;
const titleOk = (t) => /\.jpe?g$/i.test(t) && !BAD_TITLE.test(t.replace(/[_\-.,()]/g, ' '));

const trails = [
  ...snapshot.trails.map((t) => ({ id: t.id, name: existing[t.id].name, line: existing[t.id].route, cps: (t.checkpoints ?? []).map((c) => c.name_en) })),
  ...accepted.map((a) => ({ id: a.id, name: a.name_en, line: a.route, cps: [] })),
];
const previous = new Set(cand.fallback ?? []);
const targets = trails.filter((t) => (only ? only.has(t.id) : previous.has(t.id) || !(photos[t.id] ?? []).length));
console.log(`trails needing more candidates: ${targets.length}`);

function tilesAround(p, padM) {
  const padLat = padM / 111000;
  const padLng = padM / (111000 * Math.cos((p[1] * Math.PI) / 180));
  const tiles = [];
  for (let x = Math.floor((p[0] - padLng) / TILE_LNG); x <= Math.floor((p[0] + padLng) / TILE_LNG); x++)
    for (let y = Math.floor((p[1] - padLat) / TILE_LAT); y <= Math.floor((p[1] + padLat) / TILE_LAT); y++)
      tiles.push([x * TILE_LNG, y * TILE_LAT, (x + 1) * TILE_LNG, (y + 1) * TILE_LAT]);
  return tiles;
}

const tileCache = new Map();
async function filesInTile(box, depth = 0) {
  const key = box.map((v) => v.toFixed(4)).join(',');
  if (tileCache.has(key)) return tileCache.get(key);
  let list = await geosearchBox(box, 500);
  if (list.length >= 500 && depth < 3) {
    const [x0, y0, x1, y1] = box;
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    list = [];
    for (const b of [[x0, y0, mx, my], [mx, y0, x1, my], [x0, my, mx, y1], [mx, my, x1, y1]]) list.push(...(await filesInTile(b, depth + 1)));
  }
  tileCache.set(key, list);
  return list;
}

async function describe(titles) {
  const todo = [...new Set(titles)].filter((t) => !cand.files[t]);
  if (!todo.length) return;
  const info = await fileInfo(todo);
  for (const title of todo) {
    const f = info.get(title);
    cand.files[title] = f
      ? {
          title, width: f.width, height: f.height, mime: f.mime, url: f.url, thumburl: f.thumburl, thumbwidth: f.thumbwidth,
          page: f.descriptionurl, coord: f.coord, licence: acceptedLicence(f.meta),
          licence_raw: stripHtml(f.meta.LicenseShortName ?? f.meta.License ?? ''), author: authorOf(f.meta),
          description: stripHtml(f.meta.ImageDescription ?? f.meta.ObjectName ?? '').slice(0, 300),
          categories: String(f.meta.Categories ?? '').split('|').filter(Boolean).slice(0, 40),
          restrictions: f.meta.Restrictions ?? null, date: stripHtml(f.meta.DateTimeOriginal ?? '').slice(0, 20),
        }
      : { title, missing: true };
  }
}

for (const t of targets) {
  const index = new LineIndex(t.line);
  const end = t.line[t.line.length - 1];
  const list = new Map((cand.trails[t.id] ?? []).map((c) => [c.title, c]));

  // 1. geotagged files within 25 km of the trailhead or the destination
  for (const p of [t.line[0], end]) {
    for (const box of tilesAround(p, WIDE_M)) {
      for (const f of await filesInTile(box)) {
        if (list.has(f.title) || !titleOk(f.title)) continue;
        const d = index.distanceWithin(f.coord, WIDE_M);
        if (d !== Infinity) list.set(f.title, { title: f.title, coord: f.coord, dist_m: Math.round(d) });
      }
    }
  }

  // 2. named places: OSM features on the route that carry a wikidata id, then a checked name search
  const labels = [...new Set([...endParts(t.name), ...nameParts(t.name), t.name, ...t.cps].filter((l) => l && properTokens(l).length))];
  const near = features.nearLine(t.line, 3000).filter((n) => n.f.tags?.wikidata);
  const roleOf = (n) => (haversineM(n.probe, end) < 1500 ? 'destination' : labels.some((l) => labelMatches(l, n.f)) ? 'named' : 'on-route');
  const qids = new Map();
  for (const n of near) {
    if (n.distM > 1500 && !labels.some((l) => labelMatches(l, n.f))) continue;
    qids.set(n.f.tags.wikidata, { role: roleOf(n), label: englishLabel(n.f) ?? n.f.name });
  }
  for (const label of labels) {
    if ([...near].some((n) => labelMatches(label, n.f))) continue;
    for (const q of await search(properTokens(label).join(' '), 7)) if (!qids.has(q)) qids.set(q, { role: 'named', label, searched: true });
  }
  const override = placeSearch[t.id];
  if (override) for (const q of await search(override.text, 10)) qids.set(q, { role: 'destination', label: override.text, near: override.near, radius_m: override.radius_m ?? 5000 });
  const ents = await entities([...qids.keys()]);
  const places = [];
  for (const [q, meta] of qids) {
    const e = ents[q];
    if (!e) continue;
    // a searched item has to be on or near this route; OSM-linked items already are
    if (meta.near && (!e.coord || haversineM(e.coord, meta.near) > meta.radius_m)) continue;
    if (meta.searched && (!e.coord || index.distanceWithin(e.coord, 5000) === Infinity)) continue;
    places.push({ ...meta, qid: q, label: e.label ?? meta.label, images: e.images, category: e.category });
  }
  const rank = { destination: 0, named: 1, 'on-route': 2 };
  places.sort((a, b) => rank[a.role] - rank[b.role]);
  const placeTitles = new Map();
  for (const pl of places.slice(0, 8)) {
    for (const img of pl.images) placeTitles.set(`File:${img}`, pl);
    if (pl.category) for (const title of (await categoryFiles(pl.category, 150)).slice(0, 150)) if (!placeTitles.has(title)) placeTitles.set(title, pl);
  }
  const fresh = [...placeTitles.keys()].filter(titleOk);
  await describe([...list.keys(), ...fresh]);
  for (const title of fresh) {
    const f = cand.files[title];
    const pl = placeTitles.get(title);
    const d = f?.coord ? index.distanceWithin(f.coord, 200000) : Infinity;
    const prev = list.get(title);
    list.set(title, {
      title,
      coord: prev?.coord ?? f?.coord ?? null,
      dist_m: prev?.dist_m ?? (d === Infinity ? null : Math.round(d)),
      place: { qid: pl.qid, label: pl.label, role: pl.role },
    });
  }
  cand.trails[t.id] = [...list.values()].sort((a, b) => (a.dist_m ?? 1e9) - (b.dist_m ?? 1e9));
  cand.fallback = [...new Set([...(cand.fallback ?? []), t.id])];
  writeJson(path.join(WORK, 'photo-candidates.json'), cand);
  console.log(`  ${t.name}: ${list.size} candidates, places: ${places.slice(0, 8).map((p) => `${p.label} (${p.qid}, ${p.role}${p.category ? ', category' : ''}${p.images.length ? ', P18' : ''})`).join('; ') || 'none'}`);
}
cand.fallback = [...new Set([...previous, ...targets.map((t) => t.id)])];
writeJson(path.join(WORK, 'photo-candidates.json'), cand);
console.log(`fallback trails: ${cand.fallback.length}`);
