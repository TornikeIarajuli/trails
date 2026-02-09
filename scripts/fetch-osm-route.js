/**
 * Fetch exact GPS coordinates for a hiking trail from OpenStreetMap via Overpass API.
 * Parses the relation's ways and nodes into an ordered route, then outputs PostGIS SQL.
 *
 * Usage: node scripts/fetch-osm-route.js <relation_id> [trail_name]
 * Example: node scripts/fetch-osm-route.js 3817920 "Juta to Roshka"
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

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
          reject(new Error(`Failed to parse response: ${data.substring(0, 500)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function buildOrderedRoute(elements) {
  // Separate relations, ways, and nodes
  const relation = elements.find((e) => e.type === 'relation');
  const waysMap = new Map();
  const nodesMap = new Map();

  for (const el of elements) {
    if (el.type === 'way') waysMap.set(el.id, el);
    if (el.type === 'node') nodesMap.set(el.id, el);
  }

  if (!relation) throw new Error('No relation found in response');

  // Get ordered way members from the relation
  const wayMembers = relation.members
    .filter((m) => m.type === 'way')
    .map((m) => waysMap.get(m.ref))
    .filter(Boolean);

  if (wayMembers.length === 0) throw new Error('No ways found in relation');

  // Order nodes along the route by connecting ways end-to-end
  const orderedCoords = [];

  for (let i = 0; i < wayMembers.length; i++) {
    const way = wayMembers[i];
    const nodeIds = way.nodes;

    if (i === 0) {
      // First way: check if we need to reverse based on connection with next way
      if (wayMembers.length > 1) {
        const nextWay = wayMembers[1];
        const lastNode = nodeIds[nodeIds.length - 1];
        const firstNode = nodeIds[0];
        // If last node of this way connects to first/last of next, keep order
        // If first node connects, reverse
        if (
          nextWay.nodes[0] === firstNode ||
          nextWay.nodes[nextWay.nodes.length - 1] === firstNode
        ) {
          nodeIds.reverse();
        }
      }
      for (const nid of nodeIds) {
        const node = nodesMap.get(nid);
        if (node) orderedCoords.push([node.lon, node.lat]);
      }
    } else {
      // Subsequent ways: connect to previous
      const lastCoord = orderedCoords[orderedCoords.length - 1];
      const firstNodeCoord = nodesMap.get(nodeIds[0]);
      const lastNodeCoord = nodesMap.get(nodeIds[nodeIds.length - 1]);

      let ids = [...nodeIds];
      // Check if we need to reverse this way
      if (firstNodeCoord && lastNodeCoord) {
        const distToFirst = Math.abs(firstNodeCoord.lon - lastCoord[0]) + Math.abs(firstNodeCoord.lat - lastCoord[1]);
        const distToLast = Math.abs(lastNodeCoord.lon - lastCoord[0]) + Math.abs(lastNodeCoord.lat - lastCoord[1]);
        if (distToLast < distToFirst) {
          ids.reverse();
        }
      }

      // Skip first node if it's the same as last added (connection point)
      const startIdx = nodesMap.get(ids[0]) &&
        Math.abs(nodesMap.get(ids[0]).lon - lastCoord[0]) < 0.00001 &&
        Math.abs(nodesMap.get(ids[0]).lat - lastCoord[1]) < 0.00001
        ? 1
        : 0;

      for (let j = startIdx; j < ids.length; j++) {
        const node = nodesMap.get(ids[j]);
        if (node) orderedCoords.push([node.lon, node.lat]);
      }
    }
  }

  return orderedCoords;
}

function simplifyRoute(coords, maxPoints = 200) {
  // If under maxPoints, return as-is
  if (coords.length <= maxPoints) return coords;

  // Always keep first and last point, sample evenly
  const step = (coords.length - 1) / (maxPoints - 1);
  const simplified = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step);
    simplified.push(coords[idx]);
  }
  return simplified;
}

function toPostGIS(coords) {
  const points = coords.map(([lon, lat]) => `ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)`);
  const startPoint = points[0];
  const endPoint = points[points.length - 1];
  const routeLine = `ST_MakeLine(ARRAY[\n    ${points.join(',\n    ')}\n  ])`;

  return { startPoint, endPoint, routeLine };
}

async function main() {
  const relationId = process.argv[2] || '3817920';
  const trailName = process.argv[3] || 'Trail';

  console.log(`Fetching OSM relation ${relationId} (${trailName})...`);

  const query = `[out:json][timeout:60];relation(${relationId});out body;>;out skel qt;`;
  const result = await fetchOverpass(query);

  console.log(`Got ${result.elements.length} elements`);

  const nodeCount = result.elements.filter((e) => e.type === 'node').length;
  const wayCount = result.elements.filter((e) => e.type === 'way').length;
  console.log(`  ${wayCount} ways, ${nodeCount} nodes`);

  // Save raw data
  const rawPath = path.join(__dirname, `osm_${relationId}.json`);
  fs.writeFileSync(rawPath, JSON.stringify(result, null, 2));
  console.log(`Raw data saved to ${rawPath}`);

  // Build ordered route
  const coords = buildOrderedRoute(result.elements);
  console.log(`Ordered route: ${coords.length} points`);
  console.log(`  Start: [${coords[0][0].toFixed(6)}, ${coords[0][1].toFixed(6)}]`);
  console.log(`  End:   [${coords[coords.length - 1][0].toFixed(6)}, ${coords[coords.length - 1][1].toFixed(6)}]`);

  // Simplify if too many points (keep route accurate but manageable)
  const simplified = simplifyRoute(coords, 300);
  console.log(`Simplified to ${simplified.length} points`);

  // Generate PostGIS SQL
  const { startPoint, endPoint, routeLine } = toPostGIS(simplified);

  const sql = `-- ${trailName} (OSM relation ${relationId})
-- ${simplified.length} coordinate points
UPDATE trails SET
  start_point = ${startPoint},
  end_point = ${endPoint},
  route = ${routeLine}
WHERE name_en = '${trailName.replace(/'/g, "''")}';
`;

  const sqlPath = path.join(__dirname, `route_${relationId}.sql`);
  fs.writeFileSync(sqlPath, sql);
  console.log(`\nSQL saved to ${sqlPath}`);

  // Also save coordinates as JSON for debugging
  const coordsPath = path.join(__dirname, `coords_${relationId}.json`);
  fs.writeFileSync(coordsPath, JSON.stringify({
    trailName,
    relationId,
    totalRawPoints: coords.length,
    simplifiedPoints: simplified.length,
    start: { lon: simplified[0][0], lat: simplified[0][1] },
    end: { lon: simplified[simplified.length - 1][0], lat: simplified[simplified.length - 1][1] },
    coordinates: simplified,
  }, null, 2));
  console.log(`Coordinates saved to ${coordsPath}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
