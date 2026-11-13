import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const REPO = path.resolve(here, '..', '..', '..');
export const CONTENT = path.join(REPO, 'content');
export const CACHE = path.join(CONTENT, 'cache');
export const WORK = path.join(CONTENT, 'work');
export const IMAGES = path.join(CONTENT, 'images');
export const SNAPSHOT_DIR = path.join(CONTENT, 'snapshot');
export const DATA = path.resolve(here, '..', 'data');
export const SCRIPTS = path.join(REPO, 'scripts');

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function readJsonIfExists(file, fallback) {
  return fs.existsSync(file) ? readJson(file) : fallback;
}

export function writeJson(file, value, pretty = false) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, pretty ? JSON.stringify(value, null, 2) + '\n' : JSON.stringify(value));
}

/** Newest production snapshot (content/snapshot/production-YYYY-MM-DD.json). */
export function latestSnapshotPath() {
  const files = fs
    .readdirSync(SNAPSHOT_DIR)
    .filter((f) => /^production-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  if (!files.length) throw new Error('No production snapshot found — run 01-snapshot.mjs first');
  return path.join(SNAPSHOT_DIR, files[files.length - 1]);
}
