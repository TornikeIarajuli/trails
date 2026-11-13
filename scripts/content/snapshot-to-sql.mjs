// Turns a production snapshot back into SQL, to rehearse apply.mjs on a local Supabase stack that has
// the same trails, checkpoints and media rows as production (run after the migrations, before apply).
//
//   node scripts/content/snapshot-to-sql.mjs [content/snapshot/production-<date>.json]
//   -> content/snapshot/production-<date>.sql
import fs from 'node:fs';
import path from 'node:path';
import { geoJsonCoords, lineEwkt, pointEwkt } from './lib/ewkt.mjs';
import { latestSnapshotPath, readJson } from './lib/paths.mjs';

const file = path.resolve(process.argv[2] ?? latestSnapshotPath());
const snap = readJson(file);
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined ? 'NULL' : String(Number(v)));
const b = (v) => (v === null || v === undefined ? 'NULL' : v ? 'true' : 'false');
const geom = (g, kind) => {
  const c = geoJsonCoords(g);
  if (!c) return 'NULL';
  return q(kind === 'line' ? lineEwkt(c) : pointEwkt(c));
};

const out = [
  `-- Rows of ${path.basename(file)} (${snap.trail_count} trails, ${snap.checkpoint_count} checkpoints, ${snap.media_count} media rows), fetched ${snap.fetched_at}.`,
  '-- For a local rehearsal of scripts/content/apply.mjs only. Upserts by id; nothing else is touched.',
  'BEGIN;',
];
const trailCols = ['id', 'name_en', 'name_ka', 'description_en', 'description_ka', 'difficulty', 'region', 'distance_km', 'elevation_gain_m', 'estimated_hours', 'route', 'start_point', 'end_point', 'start_address', 'gpx_file_url', 'cover_image_url', 'is_published', 'status', 'status_note', 'created_at', 'updated_at'];
for (const t of snap.trails) {
  const values = [
    q(t.id), q(t.name_en), q(t.name_ka), q(t.description_en), q(t.description_ka), q(t.difficulty), q(t.region),
    n(t.distance_km), n(t.elevation_gain_m), n(t.estimated_hours), geom(t.route, 'line'), geom(t.start_point), geom(t.end_point),
    q(t.start_address), q(t.gpx_file_url), q(t.cover_image_url), b(t.is_published), q(t.status ?? 'open'), q(t.status_note), q(t.created_at), q(t.updated_at),
  ];
  out.push(`INSERT INTO trails (${trailCols.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT (id) DO UPDATE SET ${trailCols.slice(1).map((c) => `${c} = EXCLUDED.${c}`).join(', ')};`);
  for (const c of t.checkpoints) {
    const cols = ['id', 'trail_id', 'name_en', 'name_ka', 'description_en', 'description_ka', 'type', 'coordinates', 'elevation_m', 'photo_url', 'sort_order', 'is_checkable', 'created_at', 'updated_at'];
    const v = [q(c.id), q(t.id), q(c.name_en), q(c.name_ka), q(c.description_en), q(c.description_ka), q(c.type), geom(c.coordinates), n(c.elevation_m), q(c.photo_url), n(c.sort_order), b(c.is_checkable), q(c.created_at), q(c.updated_at)];
    out.push(`INSERT INTO trail_checkpoints (${cols.join(', ')}) VALUES (${v.join(', ')}) ON CONFLICT (id) DO UPDATE SET ${cols.slice(1).map((x) => `${x} = EXCLUDED.${x}`).join(', ')};`);
  }
  for (const m of t.media) {
    const cols = ['id', 'trail_id', 'type', 'url', 'caption', 'sort_order', 'created_at'];
    const v = [q(m.id), q(t.id), q(m.type), q(m.url), q(m.caption), n(m.sort_order), q(m.created_at)];
    out.push(`INSERT INTO trail_media (${cols.join(', ')}) VALUES (${v.join(', ')}) ON CONFLICT (id) DO UPDATE SET ${cols.slice(1).map((x) => `${x} = EXCLUDED.${x}`).join(', ')};`);
  }
}
out.push('COMMIT;', '');
const target = file.replace(/\.json$/, '.sql');
fs.writeFileSync(target, out.join('\n'));
console.log(`wrote ${target}`);
