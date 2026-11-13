// Elevation lookups from OpenTopoData (SRTM 30 m, ASTER 30 m as fallback for voids).
// Public instance limits: 100 locations/request, 1 request/second, 1000 requests/day —
// every looked-up point is cached on disk and the daily request count is tracked.
import fs from 'node:fs';
import path from 'node:path';
import { request, sleep } from './http.mjs';
import { CACHE, ensureDir } from './paths.mjs';

const DIR = path.join(CACHE, 'dem');
const POINTS_FILE = path.join(DIR, 'points.json');
const BUDGET_FILE = path.join(DIR, 'budget.json');
const DAILY_LIMIT = 950; // stay below the 1000/day hard limit
const BATCH = 100;

let points = null;
let budget = null;

const today = () => new Date().toISOString().slice(0, 10);
export const demKey = (p) => `${p[1].toFixed(5)},${p[0].toFixed(5)}`;

function load() {
  if (points) return;
  ensureDir(DIR);
  points = fs.existsSync(POINTS_FILE) ? JSON.parse(fs.readFileSync(POINTS_FILE, 'utf8')) : {};
  budget = fs.existsSync(BUDGET_FILE) ? JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8')) : {};
}

function save() {
  fs.writeFileSync(POINTS_FILE, JSON.stringify(points));
  fs.writeFileSync(BUDGET_FILE, JSON.stringify(budget, null, 1));
}

export function requestsUsedToday() {
  load();
  return budget[today()] ?? 0;
}

export function requestsLeftToday() {
  return DAILY_LIMIT - requestsUsedToday();
}

export class DemBudgetError extends Error {}

async function fetchBatch(dataset, keys) {
  if (requestsLeftToday() <= 0) throw new DemBudgetError(`OpenTopoData daily budget used up (${DAILY_LIMIT} requests)`);
  budget[today()] = (budget[today()] ?? 0) + 1;
  save();
  const url = `https://api.opentopodata.org/v1/${dataset}?locations=${keys.join('|')}`;
  const res = await request(url, { minIntervalMs: 1150, timeoutMs: 60_000, retries: 4, throttleKey: 'opentopodata' });
  if (res.status !== 'OK' || !Array.isArray(res.results) || res.results.length !== keys.length) {
    throw new Error(`OpenTopoData ${dataset}: unexpected response (${res.status ?? 'no status'}: ${res.error ?? ''})`);
  }
  return res.results.map((r) => (typeof r.elevation === 'number' ? r.elevation : null));
}

/**
 * Elevations (metres) for [lng, lat] points, in order; null where neither dataset has data.
 * `onlyCached` never touches the network (missing points come back as undefined).
 */
export async function elevations(coords, { onlyCached = false, onProgress } = {}) {
  load();
  const keys = coords.map(demKey);
  const missing = [...new Set(keys.filter((k) => !(k in points)))];
  if (missing.length && !onlyCached) {
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const srtm = await fetchBatch('srtm30m', batch);
      batch.forEach((k, j) => {
        points[k] = srtm[j] === null ? null : Math.round(srtm[j] * 10) / 10;
      });
      save();
      onProgress?.(Math.min(i + BATCH, missing.length), missing.length);
    }
    const voids = missing.filter((k) => points[k] === null);
    for (let i = 0; i < voids.length; i += BATCH) {
      const batch = voids.slice(i, i + BATCH);
      const aster = await fetchBatch('aster30m', batch);
      batch.forEach((k, j) => {
        if (aster[j] !== null) points[k] = Math.round(aster[j] * 10) / 10;
      });
      save();
      await sleep(50);
    }
  }
  return keys.map((k) => points[k]);
}

/** How many API requests a set of points would need right now. */
export function requestsNeeded(coords) {
  load();
  const missing = new Set(coords.map(demKey).filter((k) => !(k in points)));
  return Math.ceil(missing.size / BATCH);
}
