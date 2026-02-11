/**
 * Fix tangled routes in the database.
 * Splits routes at big jumps into segments, then reconnects them
 * by matching endpoints (like stitching way segments together).
 */

const https = require('https');

const TOKEN = 'sbp_d7fb4d25309b19b810d54f35ae582452ee68c7fc';
const PROJECT = 'neoqkksermbixgeflwjd';

function query(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 201) resolve(JSON.parse(data));
        else reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function dist(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Split route into segments at points where there's a big jump.
 */
function splitAtJumps(coords, threshold) {
  const segments = [];
  let current = [coords[0]];

  for (let i = 1; i < coords.length; i++) {
    if (dist(coords[i], coords[i - 1]) > threshold) {
      if (current.length >= 2) segments.push(current);
      current = [coords[i]];
    } else {
      current.push(coords[i]);
    }
  }
  if (current.length >= 2) segments.push(current);

  return segments;
}

/**
 * Order segments by stitching endpoints together.
 * Each segment can be reversed if needed.
 */
function stitchSegments(segments) {
  if (segments.length <= 1) return segments[0] || [];

  const used = new Set();
  // Start with the longest segment
  let longestIdx = 0;
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].length > segments[longestIdx].length) longestIdx = i;
  }

  const ordered = [...segments[longestIdx]];
  used.add(longestIdx);

  // Greedily extend from both ends
  let changed = true;
  while (changed && used.size < segments.length) {
    changed = false;
    const head = ordered[0];
    const tail = ordered[ordered.length - 1];

    let bestIdx = -1;
    let bestDist = Infinity;
    let bestEnd = ''; // 'head-start', 'head-end', 'tail-start', 'tail-end'

    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue;
      const seg = segments[i];
      const segStart = seg[0];
      const segEnd = seg[seg.length - 1];

      // Try connecting to tail
      const d1 = dist(tail, segStart); // tail -> seg start (no reverse)
      const d2 = dist(tail, segEnd);   // tail -> seg end (reverse seg)
      // Try connecting to head
      const d3 = dist(head, segEnd);   // seg end -> head (no reverse)
      const d4 = dist(head, segStart); // seg start -> head (reverse seg)

      if (d1 < bestDist) { bestDist = d1; bestIdx = i; bestEnd = 'tail-start'; }
      if (d2 < bestDist) { bestDist = d2; bestIdx = i; bestEnd = 'tail-end'; }
      if (d3 < bestDist) { bestDist = d3; bestIdx = i; bestEnd = 'head-end'; }
      if (d4 < bestDist) { bestDist = d4; bestIdx = i; bestEnd = 'head-start'; }
    }

    if (bestIdx >= 0) {
      used.add(bestIdx);
      changed = true;
      const seg = segments[bestIdx];

      switch (bestEnd) {
        case 'tail-start': // append seg as-is to tail
          ordered.push(...seg);
          break;
        case 'tail-end': // append reversed seg to tail
          ordered.push(...seg.slice().reverse());
          break;
        case 'head-end': // prepend seg as-is before head
          ordered.unshift(...seg);
          break;
        case 'head-start': // prepend reversed seg before head
          ordered.unshift(...seg.slice().reverse());
          break;
      }
    }
  }

  return ordered;
}

/**
 * Simplify route to maxPoints using uniform sampling.
 */
function simplify(coords, maxPoints) {
  if (coords.length <= maxPoints) return coords;
  const step = (coords.length - 1) / (maxPoints - 1);
  const result = [];
  for (let i = 0; i < maxPoints - 1; i++) {
    result.push(coords[Math.round(i * step)]);
  }
  result.push(coords[coords.length - 1]);
  return result;
}

function countJumps(coords, threshold) {
  let jumps = 0;
  for (let i = 1; i < coords.length; i++) {
    if (dist(coords[i], coords[i - 1]) > threshold) jumps++;
  }
  return jumps;
}

(async () => {
  console.log('Fetching all routes...\n');
  const trails = await query('SELECT id, name_en, ST_NPoints(route) as pts, ST_AsText(route) as wkt FROM trails ORDER BY id');

  const badTrails = [];

  for (const t of trails) {
    if (!t.wkt) continue;
    const coords = t.wkt.replace('LINESTRING(', '').replace(')', '').split(',').map(p => {
      const [lon, lat] = p.trim().split(' ');
      return [parseFloat(lon), parseFloat(lat)];
    });

    const jumps = countJumps(coords, 0.005);
    if (jumps > 5) {
      badTrails.push({ id: t.id, name: t.name_en, coords, jumps });
    }
  }

  console.log(`Found ${badTrails.length} trails with tangled routes\n`);

  for (const trail of badTrails) {
    console.log(`Fixing: ${trail.name} (${trail.jumps} jumps, ${trail.coords.length} pts)`);

    // Split at jumps
    const segments = splitAtJumps(trail.coords, 0.003);
    console.log(`  Split into ${segments.length} segments`);

    // Stitch segments together
    const stitched = stitchSegments(segments);

    // Simplify back to max 300 points
    const simplified = simplify(stitched, 300);

    const newJumps = countJumps(simplified, 0.005);
    console.log(`  Result: ${trail.jumps} jumps -> ${newJumps} jumps (${simplified.length} pts)`);

    if (newJumps >= trail.jumps) {
      console.log(`  SKIP: No improvement\n`);
      continue;
    }

    // Build PostGIS SQL to update
    const pointsSql = simplified.map(c => `ST_MakePoint(${c[0]}, ${c[1]})`).join(',\n    ');
    const updateSql = `
      UPDATE trails SET
        route = ST_SetSRID(ST_MakeLine(ARRAY[
          ${pointsSql}
        ]), 4326),
        start_point = ST_SetSRID(ST_MakePoint(${simplified[0][0]}, ${simplified[0][1]}), 4326),
        end_point = ST_SetSRID(ST_MakePoint(${simplified[simplified.length - 1][0]}, ${simplified[simplified.length - 1][1]}), 4326)
      WHERE id = '${trail.id}';
    `;

    try {
      await query(updateSql);
      console.log(`  UPDATED in DB\n`);
    } catch (err) {
      console.log(`  ERROR: ${err.message.substring(0, 100)}\n`);
    }
  }

  // Verify
  console.log('\n=== Verification ===');
  const after = await query('SELECT id, name_en, ST_NPoints(route) as pts, ST_AsText(route) as wkt FROM trails ORDER BY id');
  let stillBad = 0;
  for (const t of after) {
    if (!t.wkt) continue;
    const coords = t.wkt.replace('LINESTRING(', '').replace(')', '').split(',').map(p => {
      const [lon, lat] = p.trim().split(' ');
      return [parseFloat(lon), parseFloat(lat)];
    });
    const jumps = countJumps(coords, 0.005);
    if (jumps > 5) {
      stillBad++;
      console.log(`  Still bad: ${t.id.slice(-3)} ${t.name_en} (${jumps} jumps)`);
    }
  }
  console.log(`\nStill bad: ${stillBad} / ${after.length} trails`);
})();
