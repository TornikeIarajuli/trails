/**
 * Fix tangled routes v2 - uses direction-aware segment chaining.
 * Works on the DB directly via Management API.
 */

const https = require('https');
const fs = require('fs');

const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
if (!TOKEN) { console.error('Set SUPABASE_MGMT_TOKEN env var'); process.exit(1); }
const PROJECT = 'neoqkksermbixgeflwjd';

function dbQuery(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT}/database/query`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => res.statusCode === 201 ? resolve(JSON.parse(data)) : reject(new Error(`DB ${res.statusCode}: ${data.substring(0, 300)}`)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function dist(a, b) { return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2); }

function splitAtJumps(coords, threshold) {
  const segments = [];
  let cur = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    if (dist(coords[i], coords[i - 1]) > threshold) {
      if (cur.length >= 2) segments.push(cur);
      cur = [coords[i]];
    } else {
      cur.push(coords[i]);
    }
  }
  if (cur.length >= 2) segments.push(cur);
  return segments;
}

/**
 * Direction-aware segment chaining.
 * Prefers segments that continue in the general direction of travel.
 */
function chainSegmentsDirectional(segments, startCoord, endCoord) {
  if (segments.length <= 1) return segments[0] || [];

  // Find the segment closest to the start point
  let startIdx = 0;
  let startDist = Infinity;
  let startReverse = false;

  for (let i = 0; i < segments.length; i++) {
    const d1 = dist(segments[i][0], startCoord);
    const d2 = dist(segments[i][segments[i].length - 1], startCoord);
    if (d1 < startDist) { startDist = d1; startIdx = i; startReverse = false; }
    if (d2 < startDist) { startDist = d2; startIdx = i; startReverse = true; }
  }

  const used = new Set([startIdx]);
  const firstSeg = startReverse ? segments[startIdx].slice().reverse() : segments[startIdx];
  const chain = [...firstSeg];

  // General direction from start to end
  const overallDir = [endCoord[0] - startCoord[0], endCoord[1] - startCoord[1]];
  const overallLen = Math.sqrt(overallDir[0] ** 2 + overallDir[1] ** 2) || 1;
  overallDir[0] /= overallLen;
  overallDir[1] /= overallLen;

  // Greedily chain segments
  while (used.size < segments.length) {
    const tail = chain[chain.length - 1];
    // Direction of last few points in chain (local direction)
    const prevPt = chain[Math.max(0, chain.length - 5)];
    const localDir = [tail[0] - prevPt[0], tail[1] - prevPt[1]];
    const localLen = Math.sqrt(localDir[0] ** 2 + localDir[1] ** 2) || 1;
    localDir[0] /= localLen;
    localDir[1] /= localLen;

    let bestIdx = -1;
    let bestScore = Infinity;
    let bestReverse = false;

    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue;
      const seg = segments[i];
      const segStart = seg[0];
      const segEnd = seg[seg.length - 1];

      // Try both orientations
      for (const [endpoint, reverse] of [[segStart, false], [segEnd, true]]) {
        const d = dist(tail, endpoint);
        if (d > 0.05) continue; // Skip segments too far away (>5km)

        // Direction from tail to this segment's start
        const dir = [endpoint[0] - tail[0], endpoint[1] - tail[1]];
        const len = Math.sqrt(dir[0] ** 2 + dir[1] ** 2) || 1;
        dir[0] /= len;
        dir[1] /= len;

        // Dot product with local direction (prefer forward motion)
        const localDot = dir[0] * localDir[0] + dir[1] * localDir[1];
        // Dot product with overall direction (prefer toward endpoint)
        const overallDot = dir[0] * overallDir[0] + dir[1] * overallDir[1];

        // Score: lower is better. Distance matters most, direction is a tiebreaker
        const score = d * 3 - localDot * 0.003 - overallDot * 0.001;

        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
          bestReverse = reverse;
        }
      }
    }

    if (bestIdx < 0) break; // No more reachable segments

    used.add(bestIdx);
    const seg = bestReverse ? segments[bestIdx].slice().reverse() : segments[bestIdx];

    // Skip first point if it's very close to tail (junction point)
    const skipFirst = dist(seg[0], tail) < 0.0001;
    chain.push(...seg.slice(skipFirst ? 1 : 0));
  }

  return chain;
}

function simplify(coords, max) {
  if (coords.length <= max) return coords;
  const step = (coords.length - 1) / (max - 1);
  const r = [];
  for (let i = 0; i < max - 1; i++) r.push(coords[Math.round(i * step)]);
  r.push(coords[coords.length - 1]);
  return r;
}

function countJumps(coords, threshold = 0.005) {
  let j = 0;
  for (let i = 1; i < coords.length; i++) if (dist(coords[i], coords[i - 1]) > threshold) j++;
  return j;
}

// Also fix from source data (all_routes.json) which has the original unprocessed coords
function loadSourceRoutes() {
  try {
    const data = JSON.parse(fs.readFileSync('all_routes.json', 'utf8'));
    const map = new Map();
    for (const r of data.found) map.set(r.id, r);
    return map;
  } catch { return new Map(); }
}

(async () => {
  const sourceRoutes = loadSourceRoutes();

  console.log('Fetching routes from DB...\n');
  const trails = await dbQuery('SELECT id, name_en, ST_NPoints(route) as pts, ST_AsText(route) as wkt, ST_X(start_point) as sx, ST_Y(start_point) as sy, ST_X(end_point) as ex, ST_Y(end_point) as ey FROM trails ORDER BY id');

  const badTrails = [];
  for (const t of trails) {
    if (!t.wkt) continue;
    const coords = t.wkt.replace('LINESTRING(', '').replace(')', '').split(',').map(p => {
      const [lon, lat] = p.trim().split(' ');
      return [parseFloat(lon), parseFloat(lat)];
    });
    const jumps = countJumps(coords);
    if (jumps > 3) {
      // Use source data if available (has more original points)
      const source = sourceRoutes.get(t.id);
      badTrails.push({
        id: t.id,
        name: t.name_en,
        coords: source ? source.coordinates : coords,
        startCoord: source ? source.start : [parseFloat(t.sx), parseFloat(t.sy)],
        endCoord: source ? source.end : [parseFloat(t.ex), parseFloat(t.ey)],
        jumps,
        fromSource: !!source,
      });
    }
  }

  console.log(`Found ${badTrails.length} trails to fix\n`);

  for (const trail of badTrails) {
    console.log(`${trail.id.slice(-3)} ${trail.name} (${trail.jumps} jumps, source: ${trail.fromSource})`);

    // Try multiple threshold values
    let bestResult = trail.coords;
    let bestJumps = trail.jumps;

    for (const threshold of [0.003, 0.002, 0.004, 0.001]) {
      const segments = splitAtJumps(trail.coords, threshold);
      if (segments.length < 2) continue;

      const chained = chainSegmentsDirectional(segments, trail.startCoord, trail.endCoord);
      const simplified = simplify(chained, 300);
      const jumps = countJumps(simplified);

      if (jumps < bestJumps) {
        bestJumps = jumps;
        bestResult = simplified;
      }
    }

    console.log(`  ${trail.jumps} -> ${bestJumps} jumps`);

    if (bestJumps >= trail.jumps) {
      console.log(`  SKIP: no improvement\n`);
      continue;
    }

    const pointsSql = bestResult.map(c => `ST_MakePoint(${c[0]}, ${c[1]})`).join(',');
    const sql = `UPDATE trails SET
      route = ST_SetSRID(ST_MakeLine(ARRAY[${pointsSql}]), 4326),
      start_point = ST_SetSRID(ST_MakePoint(${bestResult[0][0]}, ${bestResult[0][1]}), 4326),
      end_point = ST_SetSRID(ST_MakePoint(${bestResult[bestResult.length - 1][0]}, ${bestResult[bestResult.length - 1][1]}), 4326)
      WHERE id = '${trail.id}';`;

    try {
      await dbQuery(sql);
      console.log(`  UPDATED\n`);
    } catch (e) {
      console.log(`  ERROR: ${e.message.substring(0, 100)}\n`);
    }
  }

  // Final verification
  console.log('\n=== Final Verification ===');
  const after = await dbQuery('SELECT id, name_en, ST_AsText(route) as wkt FROM trails ORDER BY id');
  let good = 0, bad = 0;
  for (const t of after) {
    if (!t.wkt) continue;
    const coords = t.wkt.replace('LINESTRING(', '').replace(')', '').split(',').map(p => {
      const [lon, lat] = p.trim().split(' ');
      return [parseFloat(lon), parseFloat(lat)];
    });
    const jumps = countJumps(coords);
    if (jumps > 3) {
      bad++;
      console.log(`  BAD: ${t.id.slice(-3)} ${t.name_en} - ${jumps} jumps`);
    } else {
      good++;
    }
  }
  console.log(`\nGood: ${good}, Bad: ${bad} / ${after.length} total`);
})();
