// Pure parts of the apply tool: argument parsing, dataset validation, value comparison,
// EWKT conversion and the per-trail plan (what would change). No I/O in this file.
import { geoJsonCoords, lineEwkt, pointEwkt } from './lib/ewkt.mjs';
import { haversineM, lineLengthM } from './lib/geo.mjs';
import { isUuidLike, mediaId } from './lib/uuid.mjs';

export const BUCKET = 'trail-media';
export const STORAGE_PREFIX = 'content';
export const STOCK_MARKER = 'images.unsplash.com';
export const CACHE_CONTROL_SECONDS = '31536000';
export const MAX_OBJECT_BYTES = 12 * 1024 * 1024;

export const TRAIL_SCALARS = [
  'name_en', 'name_ka', 'description_en', 'description_ka', 'difficulty', 'region',
  'distance_km', 'elevation_gain_m', 'estimated_hours', 'start_address',
];
export const TRAIL_GEOMS = ['route', 'start_point', 'end_point'];
export const TRAIL_FIELDS = [...TRAIL_SCALARS, ...TRAIL_GEOMS];
export const CHECKPOINT_FIELDS = [
  'name_en', 'name_ka', 'description_en', 'description_ka', 'type', 'coordinates',
  'elevation_m', 'sort_order', 'is_checkable',
];
const NUMERIC = new Set(['distance_km', 'elevation_gain_m', 'estimated_hours', 'elevation_m', 'sort_order']);
const DIFFICULTIES = ['easy', 'medium', 'hard', 'ultra'];
const CHECKPOINT_TYPES = [
  'viewpoint', 'water_source', 'campsite', 'landmark', 'summit', 'shelter', 'bridge', 'pass', 'lake',
  'waterfall', 'ruins', 'church', 'tower',
];

// ---------- arguments ----------

export function parseArgs(argv) {
  const opts = {
    apply: false, only: null, skipImages: false, skipNew: false, unpublishedNew: false, force: false,
    overwriteConflicts: false, updateNew: false, help: false, dataset: null, images: null, backups: null,
  };
  const value = (i, flag) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new Error(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--apply': opts.apply = true; break;
      case '--skip-images': opts.skipImages = true; break;
      case '--skip-new': opts.skipNew = true; break;
      case '--unpublished-new': opts.unpublishedNew = true; break;
      case '--force': opts.force = true; break;
      case '--overwrite-conflicts': opts.overwriteConflicts = true; break;
      case '--update-new': opts.updateNew = true; break;
      case '--help': case '-h': opts.help = true; break;
      case '--only':
        opts.only = value(i, a).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
        i++;
        break;
      case '--dataset': opts.dataset = value(i, a); i++; break;
      case '--images': opts.images = value(i, a); i++; break;
      case '--backups': opts.backups = value(i, a); i++; break;
      default: throw new Error(`Unknown argument: ${a}`);
    }
  }
  if (opts.only) {
    const bad = opts.only.filter((id) => !isUuidLike(id));
    if (bad.length) throw new Error(`--only expects trail ids, got: ${bad.join(', ')}`);
    if (!opts.only.length) throw new Error('--only needs at least one trail id');
  }
  return opts;
}

// ---------- dataset validation ----------

const decimalsOk = (v, digits) => Math.abs(v * 10 ** digits - Math.round(v * 10 ** digits)) < 1e-6;
const inGeorgia = (c) => Array.isArray(c) && c.length === 2 && c[0] > 39.9 && c[0] < 46.8 && c[1] > 41.0 && c[1] < 43.7;

/** Returns a list of problems; an empty list means the dataset is safe to publish. */
export function validateDataset(dataset) {
  const problems = [];
  const trails = dataset?.trails;
  if (!Array.isArray(trails) || !trails.length) return ['dataset has no trails'];
  const ids = new Set();
  const cpIds = new Set();
  for (const t of trails) {
    const where = `trail ${t?.id ?? '?'}`;
    if (!isUuidLike(t.id ?? '')) problems.push(`${where}: invalid id`);
    if (ids.has(t.id)) problems.push(`${where}: duplicate id`);
    ids.add(t.id);
    if (typeof t.is_new !== 'boolean') problems.push(`${where}: is_new must be true or false`);
    if (!t.name_en || typeof t.name_en !== 'string') problems.push(`${where}: name_en missing`);
    if (!t.region || typeof t.region !== 'string') problems.push(`${where}: region missing`);
    if (!DIFFICULTIES.includes(t.difficulty)) problems.push(`${where}: invalid difficulty ${t.difficulty}`);
    for (const f of ['distance_km', 'elevation_gain_m', 'estimated_hours']) {
      if (t[f] != null && (typeof t[f] !== 'number' || !Number.isFinite(t[f]) || t[f] < 0)) problems.push(`${where}: invalid ${f}`);
    }
    if (t.distance_km != null && (t.distance_km >= 10000 || !decimalsOk(t.distance_km, 2))) problems.push(`${where}: distance_km does not fit numeric(6,2)`);
    if (t.estimated_hours != null && (t.estimated_hours >= 1000 || !decimalsOk(t.estimated_hours, 1))) problems.push(`${where}: estimated_hours does not fit numeric(4,1)`);
    if (t.elevation_gain_m != null && !Number.isInteger(t.elevation_gain_m)) problems.push(`${where}: elevation_gain_m must be an integer`);
    if (!Array.isArray(t.route) || t.route.length < 2) problems.push(`${where}: route needs at least 2 points`);
    else if (!t.route.every(inGeorgia)) problems.push(`${where}: route has a point outside Georgia`);
    if (!inGeorgia(t.start_point) || !inGeorgia(t.end_point)) problems.push(`${where}: start/end point missing or outside Georgia`);
    if (!Array.isArray(t.changed)) problems.push(`${where}: changed[] missing`);
    else {
      for (const f of t.changed) {
        if (!TRAIL_FIELDS.includes(f)) problems.push(`${where}: changed field ${f} is not publishable`);
        else if (!t.is_new && (!t.baseline || !(f in t.baseline))) problems.push(`${where}: no baseline for changed field ${f}`);
      }
    }
    for (const c of t.checkpoints ?? []) {
      const cw = `${where} checkpoint ${c?.id ?? '?'}`;
      if (!isUuidLike(c.id ?? '')) problems.push(`${cw}: invalid id`);
      if (cpIds.has(c.id)) problems.push(`${cw}: duplicate id`);
      cpIds.add(c.id);
      if (!c.name_en) problems.push(`${cw}: name_en missing`);
      if (!CHECKPOINT_TYPES.includes(c.type)) problems.push(`${cw}: invalid type ${c.type}`);
      if (!inGeorgia(c.coordinates)) problems.push(`${cw}: coordinates missing or outside Georgia`);
      if (c.elevation_m != null && !Number.isInteger(c.elevation_m)) problems.push(`${cw}: elevation_m must be an integer`);
      if (typeof c.is_checkable !== 'boolean') problems.push(`${cw}: is_checkable must be true or false`);
      for (const f of c.changed ?? []) {
        if (!CHECKPOINT_FIELDS.includes(f)) problems.push(`${cw}: changed field ${f} is not publishable`);
        else if (!t.is_new && (!c.baseline || !(f in c.baseline))) problems.push(`${cw}: no baseline for changed field ${f}`);
      }
    }
    const files = new Set();
    let covers = 0;
    for (const p of t.photos ?? []) {
      const pw = `${where} photo ${p?.file ?? '?'}`;
      if (!/^(cover|photo-\d+)\.webp$/.test(p.file ?? '')) problems.push(`${pw}: unexpected file name`);
      if (files.has(p.file)) problems.push(`${pw}: duplicate file`);
      files.add(p.file);
      if (p.path !== `${STORAGE_PREFIX}/${t.id}/${p.file}`) problems.push(`${pw}: path must be ${STORAGE_PREFIX}/${t.id}/${p.file}`);
      if (p.role !== 'cover' && p.role !== 'gallery') problems.push(`${pw}: role must be cover or gallery`);
      if (p.role === 'cover') covers++;
      if ((p.role === 'cover') !== (p.file === 'cover.webp')) problems.push(`${pw}: only cover.webp can be the cover`);
      if (!/^Photo: .+ · .+ · Wikimedia Commons$/.test(p.caption ?? '')) problems.push(`${pw}: caption is not a credit line`);
      if (!Number.isInteger(p.bytes) || p.bytes <= 0 || p.bytes > MAX_OBJECT_BYTES) problems.push(`${pw}: bytes missing or too large`);
      if (!/^[0-9a-f]{8,40}$/.test(p.sha1 ?? '')) problems.push(`${pw}: sha1 missing`);
    }
    if (covers > 1) problems.push(`${where}: more than one cover`);
  }
  return problems;
}

// ---------- comparison ----------

const blank = (v) => v === null || v === undefined;

export function sameCoord(a, b, tol = 1e-6) {
  return Array.isArray(a) && Array.isArray(b) && Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol;
}

export function sameLine(a, b, tol = 1e-6) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!sameCoord(a[i], b[i], tol)) return false;
  return true;
}

/** Compact fingerprint of a route, used to notice that the live route is no longer the snapshot's. */
export function routeSignature(coords) {
  if (!Array.isArray(coords) || !coords.length) return null;
  return {
    points: coords.length,
    length_m: Math.round(lineLengthM(coords)),
    start: coords[0],
    end: coords[coords.length - 1],
  };
}

export function matchesSignature(coords, sig) {
  if (!sig || !Array.isArray(coords) || !coords.length) return false;
  const live = routeSignature(coords);
  return (
    live.points === sig.points &&
    Math.abs(live.length_m - sig.length_m) <= Math.max(2, sig.length_m * 0.001) &&
    haversineM(live.start, sig.start) < 1 &&
    haversineM(live.end, sig.end) < 1
  );
}

/** Live value (as PostgREST returns it) → the comparable form the dataset uses. */
export function normalizeLive(field, value) {
  if (field === 'route' || field === 'start_point' || field === 'end_point' || field === 'coordinates') return geoJsonCoords(value);
  if (NUMERIC.has(field)) return blank(value) ? null : Number(value);
  return blank(value) ? null : value;
}

export function valuesEqual(field, a, b) {
  if (blank(a) && blank(b)) return true;
  if (blank(a) || blank(b)) return false;
  if (field === 'route') return sameLine(a, b);
  if (field === 'start_point' || field === 'end_point' || field === 'coordinates') return sameCoord(a, b);
  if (NUMERIC.has(field)) return Math.abs(Number(a) - Number(b)) < 1e-9;
  return a === b;
}

/** live == baseline? (`route` baselines are signatures, everything else is the old value). */
export function equalsBaseline(field, live, baseline) {
  if (field === 'route') return matchesSignature(live, baseline);
  return valuesEqual(field, live, baseline);
}

export function toDbValue(field, value) {
  if (blank(value)) return null;
  if (field === 'route') return lineEwkt(value);
  if (field === 'start_point' || field === 'end_point' || field === 'coordinates') return pointEwkt(value);
  return value;
}

/** Short human form of a value for the dry-run diff. */
export function show(field, value) {
  if (blank(value)) return 'null';
  if (field === 'route') {
    if (!Array.isArray(value)) return `${value.points} pts, ${(value.length_m / 1000).toFixed(2)} km`;
    return `${value.length} pts, ${(lineLengthM(value) / 1000).toFixed(2)} km`;
  }
  if (field === 'start_point' || field === 'end_point' || field === 'coordinates') return `${value[1].toFixed(5)},${value[0].toFixed(5)}`;
  if (typeof value === 'string') return JSON.stringify(value.length > 70 ? `${value.slice(0, 67)}...` : value);
  return String(value);
}

// ---------- storage URLs ----------

export function publicUrl(supabaseUrl, storagePath, version) {
  const base = supabaseUrl.replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/${BUCKET}/${storagePath}${version ? `?v=${version}` : ''}`;
}

export const isStockUrl = (url) => typeof url === 'string' && url.includes(STOCK_MARKER);

/** A URL this tool wrote earlier for that trail (any project, any version suffix). */
export function isOwnContentUrl(url, trailId) {
  return typeof url === 'string' && url.includes(`/storage/v1/object/public/${BUCKET}/${STORAGE_PREFIX}/${trailId}/`);
}

// ---------- plan ----------

function threeWay(field, live, baseline, desired, overwrite) {
  if (valuesEqual(field, live, desired)) return 'same';
  if (equalsBaseline(field, live, baseline) || overwrite) return 'update';
  return 'conflict';
}

/**
 * Works out everything that would change for one trail.
 *   ds            trail from content/trails.json
 *   live          { trail, checkpoints, media } as read from the database (trail may be null)
 *   opts          parsed arguments + { supabaseUrl }
 */
export function planTrail(ds, live, opts) {
  const plan = {
    id: ds.id,
    name: ds.name_en,
    isNew: ds.is_new,
    trail: { action: 'none', changes: [], conflicts: [], patch: null, row: null },
    cover: { action: 'none', from: live.trail?.cover_image_url ?? null, to: null, reason: '' },
    media: { upsert: [], deleteIds: [], unchanged: 0, kept: 0 },
    checkpoints: { update: [], insert: [], missing: [], conflicts: [], existsUntouched: 0 },
    uploads: [],
    notes: [],
  };

  const photos = opts.skipImages ? [] : ds.photos ?? [];
  const coverPhoto = photos.find((p) => p.role === 'cover') ?? null;
  const desiredCover = coverPhoto ? publicUrl(opts.supabaseUrl, coverPhoto.path, coverPhoto.sha1.slice(0, 8)) : null;

  // --- trail row ---
  if (!live.trail) {
    if (!ds.is_new) {
      plan.trail.action = 'missing';
      plan.notes.push('not in the database (deleted since the snapshot?) — skipped, nothing is created');
      return plan;
    }
    plan.trail.action = 'insert';
    const row = { id: ds.id };
    for (const f of TRAIL_FIELDS) row[f] = toDbValue(f, ds[f]);
    row.cover_image_url = desiredCover;
    row.is_published = !opts.unpublishedNew;
    plan.trail.row = row;
    if (!opts.skipImages) plan.cover = { action: desiredCover ? 'set' : 'none', from: null, to: desiredCover, reason: '' };
  } else {
    const managed = ds.is_new ? TRAIL_FIELDS : ds.changed;
    const patch = {};
    for (const f of managed) {
      const liveValue = normalizeLive(f, live.trail[f]);
      const desired = blank(ds[f]) ? null : ds[f];
      if (ds.is_new) {
        if (valuesEqual(f, liveValue, desired)) continue;
        if (opts.updateNew) {
          patch[f] = toDbValue(f, desired);
          plan.trail.changes.push({ field: f, from: show(f, liveValue), to: show(f, desired) });
        } else {
          plan.trail.conflicts.push({ field: f, live: show(f, liveValue), desired: show(f, desired), why: 'new trail already exists with a different value (use --update-new to overwrite)' });
        }
        continue;
      }
      const verdict = threeWay(f, liveValue, ds.baseline?.[f], desired, opts.overwriteConflicts);
      if (verdict === 'update') {
        patch[f] = toDbValue(f, desired);
        plan.trail.changes.push({ field: f, from: show(f, liveValue), to: show(f, desired) });
      } else if (verdict === 'conflict') {
        plan.trail.conflicts.push({ field: f, live: show(f, liveValue), baseline: show(f, ds.baseline?.[f]), desired: show(f, desired), why: 'live value changed since the snapshot (use --overwrite-conflicts to overwrite)' });
      }
    }

    // --- cover ---
    if (!opts.skipImages) {
      const current = live.trail.cover_image_url ?? null;
      const replaceable = blank(current) || current === '' || isStockUrl(current) || isOwnContentUrl(current, ds.id);
      if (current === desiredCover || (blank(current) && blank(desiredCover))) {
        plan.cover = { action: 'none', from: current, to: desiredCover, reason: '' };
      } else if (!replaceable) {
        plan.cover = { action: 'keep', from: current, to: current, reason: 'current cover is not a stock photo — kept' };
      } else {
        patch.cover_image_url = desiredCover;
        plan.cover = { action: desiredCover ? 'set' : 'clear', from: current, to: desiredCover, reason: desiredCover ? '' : 'no real photo of this trail — stock cover removed' };
      }
    }
    if (Object.keys(patch).length) {
      plan.trail.action = 'update';
      plan.trail.patch = patch;
    }
  }

  // --- media ---
  if (!opts.skipImages) {
    // Every published photo gets a row so its credit (the caption) can be shown; the cover row is
    // sort_order 0 and has exactly the URL written to cover_image_url. When the owner's own cover is
    // kept, our cover file is not published at all.
    const published = photos
      .filter((p) => !(p.role === 'cover' && plan.cover.action === 'keep'))
      .sort((a, b) => (a.role === 'cover' ? -1 : b.role === 'cover' ? 1 : a.file.localeCompare(b.file, 'en', { numeric: true })));
    const hasCover = published[0]?.role === 'cover';
    const desiredRows = published.map((p, i) => ({
      id: mediaId(ds.id, p.file),
      trail_id: ds.id,
      type: 'photo',
      url: publicUrl(opts.supabaseUrl, p.path, p.sha1.slice(0, 8)),
      caption: p.caption,
      sort_order: hasCover ? i : i + 1,
    }));
    const desiredById = new Map(desiredRows.map((r) => [r.id, r]));
    const seen = new Set();
    for (const m of live.media) {
      const want = desiredById.get(m.id);
      if (want) {
        seen.add(m.id);
        const same = m.url === want.url && (m.caption ?? null) === want.caption && Number(m.sort_order) === want.sort_order && m.type === 'photo' && m.trail_id === ds.id;
        if (same) plan.media.unchanged++;
        else plan.media.upsert.push(want);
      } else if (isStockUrl(m.url) || isOwnContentUrl(m.url, ds.id)) {
        plan.media.deleteIds.push(m.id);
      } else {
        plan.media.kept++;
      }
    }
    for (const r of desiredRows) if (!seen.has(r.id)) plan.media.upsert.push(r);
    plan.uploads = published.map((p) => ({ file: p.file, storagePath: p.path, bytes: p.bytes }));
  }

  // --- checkpoints ---
  const liveCp = new Map(live.checkpoints.map((c) => [c.id, c]));
  for (const c of ds.checkpoints ?? []) {
    const existing = liveCp.get(c.id);
    if (!existing) {
      if (ds.is_new) {
        const row = { id: c.id, trail_id: ds.id };
        for (const f of CHECKPOINT_FIELDS) row[f] = toDbValue(f, c[f] ?? null);
        plan.checkpoints.insert.push(row);
      } else {
        plan.checkpoints.missing.push({ id: c.id, name: c.name_en });
      }
      continue;
    }
    const managed = ds.is_new ? CHECKPOINT_FIELDS : c.changed ?? [];
    const patch = {};
    const changes = [];
    for (const f of managed) {
      const liveValue = normalizeLive(f, existing[f]);
      const desired = blank(c[f]) ? null : c[f];
      if (valuesEqual(f, liveValue, desired)) continue;
      const allowed = ds.is_new ? opts.updateNew : equalsBaseline(f, liveValue, c.baseline?.[f]) || opts.overwriteConflicts;
      if (allowed) {
        patch[f] = toDbValue(f, desired);
        changes.push({ field: f, from: show(f, liveValue), to: show(f, desired) });
      } else {
        plan.checkpoints.conflicts.push({ id: c.id, name: c.name_en, field: f, live: show(f, liveValue), desired: show(f, desired) });
      }
    }
    if (changes.length) plan.checkpoints.update.push({ id: c.id, name: c.name_en, patch, changes });
    else plan.checkpoints.existsUntouched++;
  }
  return plan;
}

export function planHasWrites(plan) {
  return (
    plan.trail.action === 'insert' ||
    plan.trail.action === 'update' ||
    plan.media.upsert.length > 0 ||
    plan.media.deleteIds.length > 0 ||
    plan.checkpoints.update.length > 0 ||
    plan.checkpoints.insert.length > 0
  );
}

export function summarize(plans) {
  const s = {
    trails: { insert: 0, update: 0, unchanged: 0, missing: 0, conflicts: 0 },
    fields: {},
    covers: { set: 0, clear: 0, keep: 0 },
    media: { insert_or_update: 0, delete: 0, kept_untouched: 0, unchanged: 0 },
    checkpoints: { insert: 0, update: 0, missing: 0, conflicts: 0 },
    uploads: { files: 0, bytes: 0 },
  };
  for (const p of plans) {
    if (p.trail.action === 'insert') s.trails.insert++;
    else if (p.trail.action === 'update') s.trails.update++;
    else if (p.trail.action === 'missing') s.trails.missing++;
    else s.trails.unchanged++;
    s.trails.conflicts += p.trail.conflicts.length;
    for (const c of p.trail.changes) s.fields[c.field] = (s.fields[c.field] ?? 0) + 1;
    if (p.cover.action in s.covers) s.covers[p.cover.action]++;
    s.media.insert_or_update += p.media.upsert.length;
    s.media.delete += p.media.deleteIds.length;
    s.media.kept_untouched += p.media.kept;
    s.media.unchanged += p.media.unchanged;
    s.checkpoints.insert += p.checkpoints.insert.length;
    s.checkpoints.update += p.checkpoints.update.length;
    s.checkpoints.missing += p.checkpoints.missing.length;
    s.checkpoints.conflicts += p.checkpoints.conflicts.length;
    s.uploads.files += p.uploads.length;
    s.uploads.bytes += p.uploads.reduce((n, u) => n + u.bytes, 0);
  }
  return s;
}

/** Text lines describing one trail's plan (empty when nothing would change). */
export function describePlan(p) {
  const lines = [];
  if (p.trail.action === 'missing') return [`? ${p.id}  ${p.name}`, `    ${p.notes[0]}`];
  if (p.trail.action === 'insert') {
    lines.push(`    INSERT trail (${p.trail.row.is_published ? 'published' : 'unpublished'}): ${p.trail.row.region}, ${p.trail.row.distance_km} km, +${p.trail.row.elevation_gain_m} m, ${p.trail.row.estimated_hours} h, ${p.trail.row.difficulty}`);
  }
  for (const c of p.trail.changes) lines.push(`    ${c.field}: ${c.from} -> ${c.to}`);
  for (const c of p.trail.conflicts) lines.push(`    ! ${c.field} NOT changed: live ${c.live}, wanted ${c.desired} — ${c.why}`);
  if (p.cover.action === 'set') lines.push(`    cover_image_url: ${p.cover.from ? (isStockUrl(p.cover.from) ? 'stock photo' : 'previous upload') : 'null'} -> ${p.cover.to}`);
  if (p.cover.action === 'clear') lines.push(`    cover_image_url: stock photo -> null (${p.cover.reason})`);
  if (p.cover.action === 'keep') lines.push(`    cover_image_url kept (${p.cover.reason})`);
  if (p.media.upsert.length || p.media.deleteIds.length) {
    lines.push(`    trail_media: +${p.media.upsert.length} real photo row(s), -${p.media.deleteIds.length} stock row(s)${p.media.kept ? `, ${p.media.kept} other row(s) left untouched` : ''}`);
  }
  for (const c of p.checkpoints.update) lines.push(`    checkpoint "${c.name}": ${c.changes.map((x) => `${x.field} ${x.from} -> ${x.to}`).join('; ')}`);
  if (p.checkpoints.insert.length) lines.push(`    INSERT ${p.checkpoints.insert.length} checkpoint(s): ${p.checkpoints.insert.map((c) => c.name_en).join(', ')}`);
  for (const c of p.checkpoints.missing) lines.push(`    ? checkpoint "${c.name}" (${c.id}) is not in the database — skipped`);
  for (const c of p.checkpoints.conflicts) lines.push(`    ! checkpoint "${c.name}" ${c.field} NOT changed: live ${c.live}, wanted ${c.desired}`);
  if (!lines.length) return [];
  return [`${p.isNew ? '+' : '~'} ${p.id}  ${p.name}`, ...lines];
}
