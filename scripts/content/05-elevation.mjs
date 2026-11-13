// Step 5 — elevation profile of every measurable route (existing trails first, then new ones):
// samples <= ~120 m apart (at most 400 per trail), SRTM 30 m with ASTER for voids, light smoothing,
// ascent/descent with a 10 m hysteresis, min/max.
// Output: content/work/elevation.json  { <trail id>: { spacing_m, samples, ascent_m, ... } | { error } }
//
//   node scripts/content/05-elevation.mjs [--dry]
import path from 'node:path';
import { DemBudgetError, elevations, requestsLeftToday, requestsNeeded } from './lib/dem.mjs';
import { lineLengthM, sampleAlong } from './lib/geo.mjs';
import { profileStats } from './lib/hiking.mjs';
import { WORK, readJson, readJsonIfExists, writeJson } from './lib/paths.mjs';

const SPACING_M = 120;
const MAX_SAMPLES = 400;

const existing = readJson(path.join(WORK, 'existing-geometry.json'));
const { accepted } = readJsonIfExists(path.join(WORK, 'new-geometry.json'), { accepted: [] });

const jobs = [
  ...Object.values(existing).filter((e) => e.measurable).map((e) => ({ id: e.id, name: e.name, line: e.full ?? e.route, group: 'existing' })),
  ...accepted.map((a) => ({ id: a.id, name: a.name_en, line: a.full, group: 'new' })),
];
for (const j of jobs) j.samples = sampleAlong(j.line, SPACING_M, MAX_SAMPLES).map((s) => s.p);

const byGroup = (g) => jobs.filter((j) => j.group === g);
const need = (list) => requestsNeeded(list.flatMap((j) => j.samples));
console.log(`routes: ${byGroup('existing').length} existing + ${byGroup('new').length} new; DEM requests needed: existing ${need(byGroup('existing'))}, new ${need(byGroup('new'))} (left today: ${requestsLeftToday()})`);
if (process.argv.includes('--dry')) process.exit(0);

const out = readJsonIfExists(path.join(WORK, 'elevation.json'), {});
let unmeasured = 0;
for (const [i, j] of jobs.entries()) {
  try {
    const elevs = await elevations(j.samples);
    const stats = profileStats(elevs, 10);
    const lengthM = lineLengthM(j.line);
    out[j.id] = stats
      ? { group: j.group, spacing_m: Math.round(lengthM / Math.max(1, j.samples.length - 1)), ...stats, profile: elevs.map((e) => (e == null ? null : Math.round(e))) }
      : { group: j.group, error: 'DEM has no data for more than 20% of the samples' };
  } catch (err) {
    if (err instanceof DemBudgetError) {
      out[j.id] = { group: j.group, error: 'not measured: OpenTopoData daily budget used up' };
      unmeasured++;
      continue;
    }
    throw err;
  }
  if ((i + 1) % 10 === 0) {
    writeJson(path.join(WORK, 'elevation.json'), out);
    console.log(`  ${i + 1}/${jobs.length}`);
  }
}
writeJson(path.join(WORK, 'elevation.json'), out);
const errors = Object.values(out).filter((e) => e.error).length;
console.log(`elevation: ${Object.keys(out).length} routes, ${errors} without a result (${unmeasured} for lack of budget); requests left today: ${requestsLeftToday()}`);
