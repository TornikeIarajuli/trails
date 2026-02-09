/**
 * Fetch all trail routes from OSM Overpass API.
 * Handles rate limiting with delays between requests.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Known OSM relation IDs from our search
// relation 3817920 = Roshka - Juta (DONE)
// relation 3818361 = Mestia - Zabeshi (part of Mestia-Ushguli)
// relation 3817760 = Omalo - Atsunta
// relation 14205880 = Juta - Juta waterfall and lake
// relation 14224776 = Arsha - Stepantsminda
// relation 10543211 = Black Rock Lake Trail (Lagodekhi)
// relation 10543218 = Black Grouse Waterfall Trail (Lagodekhi)
// relation 15354522 = Mukhuri - Tobavarchkhili Lakes - Skuri
// relation 15354656 = Skuri - Tobavarchkhili lake
// relation 13316316 = Diklo-Chigho-Dartlo (includes Omalo area)
// relation 12211128 = Omalo-Diklo

// TCT Mestia to Ushguli segments:
// 13703284 = TCT Mestia to Adishi
// 13703285 = TCT Adishi to Ushguli
// 3685972 = Adishi - Iprali
// 3685989 = Iprari - Ushguli

// Trail configs: name, search strategy
const TRAILS = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Gergeti Trinity Church',
    // No relation exists. Search for paths near the church
    strategy: 'paths_near',
    lat: 42.6627, lon: 44.6159,
    startLat: 42.6598, startLon: 44.6198,
    radius: 3000,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    name: 'Mestia to Ushguli Trek',
    // Use TCT segments: Mestia->Adishi + Adishi->Ushguli
    strategy: 'multi_relation',
    relations: [13703284, 13703285],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000004',
    name: 'Omalo to Dartlo',
    // Search for path connecting Omalo to Dartlo
    strategy: 'paths_between',
    startLat: 42.3933, startLon: 45.6325,
    endLat: 42.4283, endLon: 45.5833,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000005',
    name: 'Truso Valley',
    // Search for paths in Truso valley area
    strategy: 'paths_near',
    lat: 42.5850, lon: 44.4900,
    startLat: 42.5680, startLon: 44.5400,
    radius: 8000,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000006',
    name: 'Lagodekhi Waterfall Trail',
    strategy: 'relation',
    relationId: 10543218, // Black Grouse Waterfall Trail
  },
  {
    id: 'a0000000-0000-0000-0000-000000000007',
    name: 'Borjomi-Kharagauli: Likani Trail',
    strategy: 'relation',
    relationId: 3740297, // Nikoloz Romanoff Trail (Borjomi-Kharagauli)
  },
  {
    id: 'a0000000-0000-0000-0000-000000000008',
    name: 'Chaukhi Pass',
    // Chaukhi pass is part of the Juta-Roshka route, but as a standalone
    // it's the climb from Juta side to the pass. We can extract from relation 3817920
    strategy: 'partial_relation',
    relationId: 3817920,
    // Take first half of route (Juta to pass area)
    fraction: 0.55,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000009',
    name: 'Martvili Canyon Trail',
    // Short trail, search for paths near canyon
    strategy: 'paths_near',
    lat: 42.4560, lon: 42.3780,
    startLat: 42.4560, startLon: 42.3780,
    radius: 2000,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000010',
    name: 'Okatse Canyon Trail',
    // Search for paths near Okatse canyon
    strategy: 'paths_near',
    lat: 42.3920, lon: 42.4400,
    startLat: 42.3850, startLon: 42.4340,
    radius: 3000,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000011',
    name: 'Shatili to Mutso',
    // Search for paths between Shatili and Mutso
    strategy: 'paths_near',
    lat: 42.6340, lon: 45.1900,
    startLat: 42.6250, startLon: 45.1750,
    radius: 5000,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000012',
    name: 'Tobavarchkhili (Silver Lake)',
    strategy: 'multi_relation',
    relations: [15354522, 15354656], // Mukhuri-Tobavarchkhili-Skuri + Skuri-Tobavarchkhili
  },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchOverpass(query) {
  return new Promise((resolve, reject) => {
    const postData = `data=${encodeURIComponent(query)}`;
    const url = new URL(OVERPASS_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          // Check if rate limited
          if (data.includes('rate_limited') || data.includes('Too Many Requests') || data.includes('try again')) {
            reject(new Error('RATE_LIMITED'));
          } else {
            reject(new Error(`Parse error: ${data.substring(0, 200)}`));
          }
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function fetchWithRetry(query, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchOverpass(query);
    } catch (e) {
      if ((e.message === 'RATE_LIMITED' || e.message.includes('Parse error')) && i < maxRetries - 1) {
        const waitSec = (i + 1) * 20;
        console.log(`  Rate limited, waiting ${waitSec}s... (attempt ${i+1}/${maxRetries})`);
        await sleep(waitSec * 1000);
      } else {
        throw e;
      }
    }
  }
}

function buildOrderedRoute(elements) {
  const relation = elements.find((e) => e.type === 'relation');
  const waysMap = new Map();
  const nodesMap = new Map();

  for (const el of elements) {
    if (el.type === 'way') waysMap.set(el.id, el);
    if (el.type === 'node') nodesMap.set(el.id, el);
  }

  if (!relation) throw new Error('No relation found');

  const wayMembers = relation.members
    .filter((m) => m.type === 'way')
    .map((m) => waysMap.get(m.ref))
    .filter(Boolean);

  if (wayMembers.length === 0) throw new Error('No ways in relation');

  const orderedCoords = [];

  for (let i = 0; i < wayMembers.length; i++) {
    const way = wayMembers[i];
    const nodeIds = [...way.nodes];

    if (i === 0) {
      if (wayMembers.length > 1) {
        const nextWay = wayMembers[1];
        const lastNode = nodeIds[nodeIds.length - 1];
        const firstNode = nodeIds[0];
        if (nextWay.nodes[0] === firstNode || nextWay.nodes[nextWay.nodes.length - 1] === firstNode) {
          nodeIds.reverse();
        }
      }
      for (const nid of nodeIds) {
        const node = nodesMap.get(nid);
        if (node) orderedCoords.push([node.lon, node.lat]);
      }
    } else {
      const lastCoord = orderedCoords[orderedCoords.length - 1];
      const firstNodeCoord = nodesMap.get(nodeIds[0]);
      const lastNodeCoord = nodesMap.get(nodeIds[nodeIds.length - 1]);

      let ids = [...nodeIds];
      if (firstNodeCoord && lastNodeCoord) {
        const distToFirst = Math.abs(firstNodeCoord.lon - lastCoord[0]) + Math.abs(firstNodeCoord.lat - lastCoord[1]);
        const distToLast = Math.abs(lastNodeCoord.lon - lastCoord[0]) + Math.abs(lastNodeCoord.lat - lastCoord[1]);
        if (distToLast < distToFirst) ids.reverse();
      }

      const startIdx = nodesMap.get(ids[0]) &&
        Math.abs(nodesMap.get(ids[0]).lon - lastCoord[0]) < 0.00001 &&
        Math.abs(nodesMap.get(ids[0]).lat - lastCoord[1]) < 0.00001 ? 1 : 0;

      for (let j = startIdx; j < ids.length; j++) {
        const node = nodesMap.get(ids[j]);
        if (node) orderedCoords.push([node.lon, node.lat]);
      }
    }
  }

  return orderedCoords;
}

function buildRouteFromWays(elements) {
  const ways = elements.filter(e => e.type === 'way' && e.nodes);
  const nodesMap = new Map();
  for (const el of elements) {
    if (el.type === 'node') nodesMap.set(el.id, el);
  }

  if (ways.length === 0) return [];

  // Build adjacency from ways
  const allCoords = [];
  for (const way of ways) {
    for (const nid of way.nodes) {
      const node = nodesMap.get(nid);
      if (node) allCoords.push([node.lon, node.lat]);
    }
  }

  // Simple: just return all nodes from all ways in order
  // Deduplicate consecutive duplicates
  const deduped = [allCoords[0]];
  for (let i = 1; i < allCoords.length; i++) {
    if (allCoords[i][0] !== allCoords[i-1][0] || allCoords[i][1] !== allCoords[i-1][1]) {
      deduped.push(allCoords[i]);
    }
  }
  return deduped;
}

function simplifyRoute(coords, maxPoints = 300) {
  if (coords.length <= maxPoints) return coords;
  const step = (coords.length - 1) / (maxPoints - 1);
  const simplified = [];
  for (let i = 0; i < maxPoints; i++) {
    simplified.push(coords[Math.round(i * step)]);
  }
  return simplified;
}

function toPostGISInsertFragment(coords) {
  const points = coords.map(([lon, lat]) => `    ST_MakePoint(${lon}, ${lat})`);
  return {
    startPoint: `ST_SetSRID(ST_MakePoint(${coords[0][0]}, ${coords[0][1]}), 4326)`,
    endPoint: `ST_SetSRID(ST_MakePoint(${coords[coords.length-1][0]}, ${coords[coords.length-1][1]}), 4326)`,
    routeArray: points.join(',\n'),
  };
}

async function fetchRelation(relationId) {
  const query = `[out:json][timeout:60];relation(${relationId});out body;>;out skel qt;`;
  const result = await fetchWithRetry(query);
  return buildOrderedRoute(result.elements);
}

async function fetchMultiRelation(relationIds) {
  let allCoords = [];
  for (const relId of relationIds) {
    console.log(`  Fetching relation ${relId}...`);
    const coords = await fetchRelation(relId);
    console.log(`    Got ${coords.length} points`);

    if (allCoords.length > 0) {
      // Connect: check if we need to reverse
      const lastPrev = allCoords[allCoords.length - 1];
      const firstNew = coords[0];
      const lastNew = coords[coords.length - 1];
      const distToFirst = Math.abs(firstNew[0] - lastPrev[0]) + Math.abs(firstNew[1] - lastPrev[1]);
      const distToLast = Math.abs(lastNew[0] - lastPrev[0]) + Math.abs(lastNew[1] - lastPrev[1]);
      if (distToLast < distToFirst) coords.reverse();

      // Skip first point if duplicate
      const startIdx = Math.abs(coords[0][0] - lastPrev[0]) < 0.0001 && Math.abs(coords[0][1] - lastPrev[1]) < 0.0001 ? 1 : 0;
      allCoords = allCoords.concat(coords.slice(startIdx));
    } else {
      allCoords = coords;
    }
    await sleep(5000);
  }
  return allCoords;
}

async function fetchPathsNear(lat, lon, radius) {
  const query = `[out:json][timeout:60];way['highway'~'path|track|footway'](around:${radius},${lat},${lon});out body;>;out skel qt;`;
  const result = await fetchWithRetry(query);
  return { elements: result.elements, ways: result.elements.filter(e => e.type === 'way') };
}

async function processTrail(trail) {
  console.log(`\n--- ${trail.name} (${trail.strategy}) ---`);

  try {
    let coords = [];

    switch (trail.strategy) {
      case 'relation': {
        coords = await fetchRelation(trail.relationId);
        break;
      }
      case 'multi_relation': {
        coords = await fetchMultiRelation(trail.relations);
        break;
      }
      case 'partial_relation': {
        const fullCoords = await fetchRelation(trail.relationId);
        const cutoff = Math.round(fullCoords.length * trail.fraction);
        coords = fullCoords.slice(0, cutoff);
        break;
      }
      case 'paths_near': {
        const { elements, ways } = await fetchPathsNear(trail.lat, trail.lon, trail.radius);
        if (ways.length === 0) {
          console.log('  No paths found nearby');
          return null;
        }
        console.log(`  Found ${ways.length} paths nearby`);
        coords = buildRouteFromWays(elements);
        break;
      }
      case 'paths_between': {
        // Search for paths in an area between start and end
        const midLat = (trail.startLat + trail.endLat) / 2;
        const midLon = (trail.startLon + trail.endLon) / 2;
        const { elements, ways } = await fetchPathsNear(midLat, midLon, 8000);
        if (ways.length === 0) {
          console.log('  No paths found between points');
          return null;
        }
        console.log(`  Found ${ways.length} paths in area`);
        coords = buildRouteFromWays(elements);
        break;
      }
    }

    if (coords.length < 3) {
      console.log(`  Only ${coords.length} points - not enough`);
      return null;
    }

    console.log(`  Raw: ${coords.length} points`);
    const simplified = simplifyRoute(coords, 300);
    console.log(`  Simplified: ${simplified.length} points`);
    console.log(`  Start: [${simplified[0][0].toFixed(6)}, ${simplified[0][1].toFixed(6)}]`);
    console.log(`  End:   [${simplified[simplified.length-1][0].toFixed(6)}, ${simplified[simplified.length-1][1].toFixed(6)}]`);

    return {
      ...trail,
      coords: simplified,
      rawCount: coords.length,
    };
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    return null;
  }
}

async function main() {
  const results = [];

  for (let i = 0; i < TRAILS.length; i++) {
    const result = await processTrail(TRAILS[i]);
    results.push(result);

    // Rate limit delay between requests
    if (i < TRAILS.length - 1) {
      console.log('  Waiting 12s...');
      await sleep(12000);
    }
  }

  // Summary
  console.log('\n\n=== SUMMARY ===');
  const found = results.filter(r => r !== null);
  const notFound = TRAILS.filter((t, i) => results[i] === null);

  console.log(`Found: ${found.length}/${TRAILS.length}`);
  found.forEach(r => console.log(`  ✓ ${r.name}: ${r.coords.length} points`));
  if (notFound.length > 0) {
    console.log(`Not found:`);
    notFound.forEach(t => console.log(`  ✗ ${t.name}`));
  }

  // Save results
  const outputPath = path.join(__dirname, 'all_routes.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    found: found.map(r => ({
      id: r.id,
      name: r.name,
      rawCount: r.rawCount,
      simplifiedCount: r.coords.length,
      start: { lon: r.coords[0][0], lat: r.coords[0][1] },
      end: { lon: r.coords[r.coords.length-1][0], lat: r.coords[r.coords.length-1][1] },
      coordinates: r.coords,
    })),
    notFound: notFound.map(t => ({ id: t.id, name: t.name })),
  }, null, 2));
  console.log(`\nSaved to ${outputPath}`);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
