/**
 * Re-fetch tangled routes from OSM with proper way-endpoint chaining.
 * This properly orders ways within a relation by connecting endpoints.
 */

const https = require('https');

const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
if (!TOKEN) { console.error('Set SUPABASE_MGMT_TOKEN env var'); process.exit(1); }
const PROJECT = 'neoqkksermbixgeflwjd';

// Trail name -> OSM relation ID (manually looked up or from previous fetches)
const TRAILS_TO_REFETCH = [
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'Gergeti Trinity Church' },
  { id: 'a0000000-0000-0000-0000-000000000004', name: 'Omalo to Dartlo' },
  { id: 'a0000000-0000-0000-0000-000000000005', name: 'Truso Valley' },
  { id: 'a0000000-0000-0000-0000-000000000009', name: 'Martvili Canyon Trail' },
  { id: 'a0000000-0000-0000-0000-000000000010', name: 'Okatse Canyon Trail' },
  { id: 'a0000000-0000-0000-0000-000000000011', name: 'Shatili to Mutso' },
  { id: 'a0000000-0000-0000-0000-000000000012', name: 'Tobavarchkhili (Silver Lake)' },
  { id: 'a0000000-0000-0000-0000-000000000046', name: 'St. Andrews Trail' },
  { id: 'a0000000-0000-0000-0000-000000000127', name: 'Omalo-Shatili' },
  { id: 'a0000000-0000-0000-0000-000000000140', name: 'Transcaucasian Trail' },
  { id: 'a0000000-0000-0000-0000-000000000146', name: 'Tusheti Omalo 2-3 Nights Round Trail' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'GeorgiaTrails/1.0' },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => res.statusCode === 200 ? resolve(data) : reject(new Error(`HTTP ${res.statusCode}`)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

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
      res.on('end', () => res.statusCode === 201 ? resolve(JSON.parse(data)) : reject(new Error(`DB ${res.statusCode}: ${data.substring(0, 200)}`)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function dist(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

/**
 * Properly order ways in a relation by chaining endpoints.
 */
function chainWays(ways, nodes) {
  if (ways.length === 0) return [];

  // Build coordinate arrays for each way
  const wayCoords = ways.map(w => {
    return w.nodes.map(nid => nodes.get(nid)).filter(Boolean);
  }).filter(w => w.length >= 2);

  if (wayCoords.length === 0) return [];
  if (wayCoords.length === 1) return wayCoords[0];

  // Chain ways by connecting endpoints
  const used = new Set();
  const chain = [wayCoords[0]];
  used.add(0);

  let changed = true;
  while (changed) {
    changed = false;
    const chainStart = chain[0][0];
    const chainEnd = chain[chain.length - 1][chain[chain.length - 1].length - 1];

    let bestIdx = -1, bestDist = 0.01, bestMode = ''; // threshold: ~1km

    for (let i = 0; i < wayCoords.length; i++) {
      if (used.has(i)) continue;
      const w = wayCoords[i];
      const wStart = w[0];
      const wEnd = w[w.length - 1];

      // Append to chain end
      const d1 = dist(chainEnd, wStart);
      const d2 = dist(chainEnd, wEnd);
      // Prepend to chain start
      const d3 = dist(chainStart, wEnd);
      const d4 = dist(chainStart, wStart);

      if (d1 < bestDist) { bestDist = d1; bestIdx = i; bestMode = 'append'; }
      if (d2 < bestDist) { bestDist = d2; bestIdx = i; bestMode = 'append-rev'; }
      if (d3 < bestDist) { bestDist = d3; bestIdx = i; bestMode = 'prepend'; }
      if (d4 < bestDist) { bestDist = d4; bestIdx = i; bestMode = 'prepend-rev'; }
    }

    if (bestIdx >= 0) {
      used.add(bestIdx);
      changed = true;
      const w = wayCoords[bestIdx];
      switch (bestMode) {
        case 'append': chain.push(w); break;
        case 'append-rev': chain.push(w.slice().reverse()); break;
        case 'prepend': chain.unshift(w); break;
        case 'prepend-rev': chain.unshift(w.slice().reverse()); break;
      }
    }
  }

  // Add any remaining unused ways (disconnected segments) at the closest point
  for (let i = 0; i < wayCoords.length; i++) {
    if (!used.has(i)) {
      chain.push(wayCoords[i]);
      used.add(i);
    }
  }

  // Flatten chain into single coordinate array, removing duplicate junction points
  const result = [];
  for (const segment of chain) {
    for (let i = 0; i < segment.length; i++) {
      if (result.length === 0 || dist(segment[i], result[result.length - 1]) > 0.00001) {
        result.push(segment[i]);
      }
    }
  }

  return result;
}

function simplify(coords, max) {
  if (coords.length <= max) return coords;
  const step = (coords.length - 1) / (max - 1);
  const r = [];
  for (let i = 0; i < max - 1; i++) r.push(coords[Math.round(i * step)]);
  r.push(coords[coords.length - 1]);
  return r;
}

function countJumps(coords) {
  let j = 0;
  for (let i = 1; i < coords.length; i++) if (dist(coords[i], coords[i - 1]) > 0.005) j++;
  return j;
}

async function searchAndFetch(name) {
  // Search for the trail on OSM
  const searchQuery = `[out:json][timeout:30];
    relation["route"~"hiking|foot"]["name"~"${name.replace(/['"()]/g, '')}", i](40.5,40.0,43.5,47.0);
    out body;`;

  let result;
  try {
    result = await httpPost('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(searchQuery)}`);
  } catch (e) {
    console.log(`  Search failed: ${e.message}`);
    return null;
  }

  const data = JSON.parse(result);
  const relations = (data.elements || []).filter(e => e.type === 'relation');

  if (relations.length === 0) {
    // Try as way
    const wayQuery = `[out:json][timeout:30];
      way["highway"~"path|track|footway"]["name"~"${name.replace(/['"()]/g, '')}", i](40.5,40.0,43.5,47.0);
      out body; >; out skel qt;`;
    try {
      result = await httpPost('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(wayQuery)}`);
      const wayData = JSON.parse(result);
      const ways = wayData.elements.filter(e => e.type === 'way');
      if (ways.length === 0) {
        console.log(`  Not found on OSM`);
        return null;
      }
      // Get nodes
      const nodes = new Map();
      for (const el of wayData.elements) {
        if (el.type === 'node') nodes.set(el.id, [el.lon, el.lat]);
      }
      const coords = chainWays(ways, nodes);
      return coords.length >= 2 ? coords : null;
    } catch (e) {
      console.log(`  Way search failed: ${e.message}`);
      return null;
    }
  }

  // Pick best relation (prefer one with most members)
  const rel = relations.sort((a, b) => (b.members || []).length - (a.members || []).length)[0];
  console.log(`  Found relation ${rel.id} (${rel.tags?.name || name}) with ${(rel.members || []).length} members`);

  await sleep(3000);

  // Fetch full relation data with nodes
  const fetchQuery = `[out:json][timeout:90];
    relation(${rel.id});
    (._;>;);
    out body;`;

  try {
    result = await httpPost('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(fetchQuery)}`);
  } catch (e) {
    console.log(`  Fetch failed: ${e.message}`);
    return null;
  }

  const fullData = JSON.parse(result);
  const nodes = new Map();
  for (const el of fullData.elements) {
    if (el.type === 'node') nodes.set(el.id, [el.lon, el.lat]);
  }

  const relData = fullData.elements.find(e => e.type === 'relation');
  if (!relData) return null;

  // Get ways in member order
  const wayMembers = (relData.members || []).filter(m => m.type === 'way');
  const allWays = fullData.elements.filter(e => e.type === 'way');
  const wayMap = new Map(allWays.map(w => [w.id, w]));

  const orderedWays = wayMembers.map(m => wayMap.get(m.ref)).filter(Boolean);
  console.log(`  ${orderedWays.length} ways, ${nodes.size} nodes`);

  const coords = chainWays(orderedWays, nodes);
  return coords.length >= 2 ? coords : null;
}

(async () => {
  for (const trail of TRAILS_TO_REFETCH) {
    console.log(`\n${trail.id.slice(-3)} ${trail.name}`);

    const coords = await searchAndFetch(trail.name);

    if (!coords) {
      console.log(`  FAILED - keeping existing route`);
      await sleep(5000);
      continue;
    }

    const simplified = simplify(coords, 300);
    const jumps = countJumps(simplified);
    console.log(`  Got ${coords.length} pts -> simplified to ${simplified.length}, ${jumps} jumps`);

    if (jumps > 10) {
      console.log(`  WARNING: Still has ${jumps} jumps, but updating anyway`);
    }

    const pointsSql = simplified.map(c => `ST_MakePoint(${c[0]}, ${c[1]})`).join(',');
    const sql = `UPDATE trails SET
      route = ST_SetSRID(ST_MakeLine(ARRAY[${pointsSql}]), 4326),
      start_point = ST_SetSRID(ST_MakePoint(${simplified[0][0]}, ${simplified[0][1]}), 4326),
      end_point = ST_SetSRID(ST_MakePoint(${simplified[simplified.length - 1][0]}, ${simplified[simplified.length - 1][1]}), 4326)
      WHERE id = '${trail.id}';`;

    try {
      await dbQuery(sql);
      console.log(`  UPDATED in DB`);
    } catch (e) {
      console.log(`  DB error: ${e.message.substring(0, 100)}`);
    }

    await sleep(8000); // Rate limit
  }

  // Final check
  console.log('\n=== Final Verification ===');
  const after = await dbQuery('SELECT id, name_en, ST_NPoints(route) as pts, ST_AsText(route) as wkt FROM trails ORDER BY id');
  let bad = 0;
  for (const t of after) {
    if (!t.wkt) continue;
    const coords = t.wkt.replace('LINESTRING(', '').replace(')', '').split(',').map(p => {
      const [lon, lat] = p.trim().split(' ');
      return [parseFloat(lon), parseFloat(lat)];
    });
    const jumps = countJumps(coords);
    if (jumps > 5) {
      bad++;
      console.log(`  ${t.id.slice(-3)} ${t.name_en}: ${jumps} jumps`);
    }
  }
  console.log(`Bad routes: ${bad} / ${after.length}`);
})();
