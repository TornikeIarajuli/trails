/**
 * Fetch route coordinates for all discovered trails from OSM Overpass API.
 * Reads discovered_trails.json, fetches geometry for each relation.
 * Resumable — saves progress after each trail.
 * Outputs: all_discovered_routes.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

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
          resolve(JSON.parse(data));
        } catch (e) {
          if (data.includes('rate_limited') || data.includes('Too Many Requests') || data.includes('runtime error') || data.includes('Gateway')) {
            reject(new Error('RATE_LIMITED'));
          } else {
            reject(new Error(`Parse error: ${data.substring(0, 300)}`));
          }
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function fetchWithRetry(query, maxRetries = 6) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchOverpass(query);
    } catch (e) {
      if (i < maxRetries - 1) {
        const waitSec = (i + 1) * 25;
        console.log(`  Rate limited, waiting ${waitSec}s... (attempt ${i + 1}/${maxRetries})`);
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

function simplifyRoute(coords, maxPoints = 300) {
  if (coords.length <= maxPoints) return coords;
  const step = (coords.length - 1) / (maxPoints - 1);
  const simplified = [];
  for (let i = 0; i < maxPoints; i++) {
    simplified.push(coords[Math.round(i * step)]);
  }
  return simplified;
}

async function processTrail(trail) {
  const name = trail.name_en || trail.name_ka || `relation ${trail.relationId}`;
  console.log(`\n--- ${name} (relation ${trail.relationId}) ---`);

  try {
    const query = `[out:json][timeout:60];relation(${trail.relationId});out body;>;out skel qt;`;
    const result = await fetchWithRetry(query);

    if (!result.elements || result.elements.length === 0) {
      console.log('  No elements returned');
      return null;
    }

    const coords = buildOrderedRoute(result.elements);

    if (coords.length < 3) {
      console.log(`  Only ${coords.length} points - not enough`);
      return null;
    }

    console.log(`  Raw: ${coords.length} points`);
    const simplified = simplifyRoute(coords, 300);
    console.log(`  Simplified: ${simplified.length} points`);
    console.log(`  Start: [${simplified[0][0].toFixed(6)}, ${simplified[0][1].toFixed(6)}]`);
    console.log(`  End:   [${simplified[simplified.length - 1][0].toFixed(6)}, ${simplified[simplified.length - 1][1].toFixed(6)}]`);

    return {
      relationId: trail.relationId,
      name_en: trail.name_en,
      name_ka: trail.name_ka,
      description: trail.description || '',
      distance_tag: trail.distance || '',
      ascent_tag: trail.ascent || '',
      coords: simplified,
      rawCount: coords.length,
      simplifiedCount: simplified.length,
      start: { lon: simplified[0][0], lat: simplified[0][1] },
      end: { lon: simplified[simplified.length - 1][0], lat: simplified[simplified.length - 1][1] },
    };
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    return null;
  }
}

async function main() {
  const discoveredPath = path.join(__dirname, 'discovered_trails.json');
  if (!fs.existsSync(discoveredPath)) {
    console.error('discovered_trails.json not found. Run discover-georgia-trails.js first.');
    process.exit(1);
  }

  const trails = JSON.parse(fs.readFileSync(discoveredPath, 'utf8'));
  console.log(`Fetching coordinates for ${trails.length} discovered trails...\n`);

  // Load existing progress
  const outputPath = path.join(__dirname, 'all_discovered_routes.json');
  let existingResults = { found: [], notFound: [] };
  const processedIds = new Set();

  if (fs.existsSync(outputPath)) {
    try {
      existingResults = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      for (const r of existingResults.found) processedIds.add(r.relationId);
      for (const r of existingResults.notFound) processedIds.add(r.relationId);
      console.log(`Resuming: ${processedIds.size} trails already processed\n`);
    } catch {
      console.log('Could not read existing results, starting fresh\n');
    }
  }

  const found = [...existingResults.found];
  const notFoundIds = new Set(existingResults.notFound.map(r => r.relationId));
  let fetchCount = 0;

  for (let i = 0; i < trails.length; i++) {
    const trail = trails[i];

    if (processedIds.has(trail.relationId)) {
      continue;
    }

    const result = await processTrail(trail);

    if (result) {
      found.push(result);
    } else {
      notFoundIds.add(trail.relationId);
    }

    fetchCount++;

    // Save progress after every trail
    const notFoundList = trails.filter(t => notFoundIds.has(t.relationId)).map(t => ({
      relationId: t.relationId,
      name: t.name_en || t.name_ka,
    }));
    fs.writeFileSync(outputPath, JSON.stringify({ found, notFound: notFoundList }, null, 2));

    // Rate limit delay
    if (i < trails.length - 1 && !processedIds.has(trails[i + 1]?.relationId)) {
      const delay = fetchCount % 5 === 0 ? 20000 : 12000;
      console.log(`  Waiting ${delay / 1000}s...`);
      await sleep(delay);
    }
  }

  // Final save
  const notFoundList = trails.filter(t => notFoundIds.has(t.relationId)).map(t => ({
    relationId: t.relationId,
    name: t.name_en || t.name_ka,
  }));
  fs.writeFileSync(outputPath, JSON.stringify({ found, notFound: notFoundList }, null, 2));

  console.log('\n\n=== FINAL SUMMARY ===');
  console.log(`Found: ${found.length}/${trails.length}`);
  found.forEach(r => console.log(`  OK ${r.name_en || r.name_ka}: ${r.simplifiedCount} points`));
  if (notFoundList.length > 0) {
    console.log(`\nFailed (${notFoundList.length}):`);
    notFoundList.forEach(t => console.log(`  FAIL ${t.name}`));
  }
  console.log(`\nSaved to ${outputPath}`);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
