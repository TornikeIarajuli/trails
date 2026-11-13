/**
 * Fetch ALL viable named trail routes from OSM Overpass API.
 * Excludes: unnamed, planned, Abkhazia/Russian, duplicate sub-segments.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// All new trails to fetch (complementing existing 12)
// Existing relation IDs already used: 3817920, 13703284, 13703285, 10543218, 3740297, 15354522, 15354656
const NEW_TRAILS = [
  // === SVANETI ===
  { id: 'a0000000-0000-0000-0000-000000000013', relationId: 3684676, name: 'Koruldi Lakes' },
  { id: 'a0000000-0000-0000-0000-000000000014', relationId: 3671427, name: 'Mestia to Chalaadi Glacier' },
  { id: 'a0000000-0000-0000-0000-000000000015', relationId: 2418279, name: 'Mazeri to Ushba Glacier' },
  { id: 'a0000000-0000-0000-0000-000000000016', relationId: 2418280, name: 'Mestia - Guli Pass - Mazeri' },
  { id: 'a0000000-0000-0000-0000-000000000017', relationId: 2418278, name: 'Ushguli to Chvelpi' },
  { id: 'a0000000-0000-0000-0000-000000000018', relationId: 3720225, name: 'Ushguli to Shkhara Glacier' },
  { id: 'a0000000-0000-0000-0000-000000000019', relationId: 10507483, name: 'Laila Glacier Trail' },
  { id: 'a0000000-0000-0000-0000-000000000020', relationId: 10507503, name: 'Zhabeshi to Tviberi Glacier' },
  { id: 'a0000000-0000-0000-0000-000000000021', relationId: 13078189, name: 'Mazeri - Meziri Lake - Etseri' },
  { id: 'a0000000-0000-0000-0000-000000000022', relationId: 15351445, name: 'Mestia - Hatsvali - Zuruldi' },
  { id: 'a0000000-0000-0000-0000-000000000023', relationId: 15352304, name: 'Mount Laila Traverse' },
  { id: 'a0000000-0000-0000-0000-000000000024', relationId: 15352496, name: 'Khaishi to Lakumura Lake' },
  { id: 'a0000000-0000-0000-0000-000000000025', relationId: 15378089, name: 'Okrostskali Lakes' },
  { id: 'a0000000-0000-0000-0000-000000000026', relationId: 15394285, name: 'Lake Memuli' },
  { id: 'a0000000-0000-0000-0000-000000000027', relationId: 10507501, name: 'Latali to Mheer Church' },
  { id: 'a0000000-0000-0000-0000-000000000028', relationId: 10544195, name: 'Chvabiani to Adishi' },
  { id: 'a0000000-0000-0000-0000-000000000029', relationId: 11115965, name: 'Kala to Latpari Pass' },
  { id: 'a0000000-0000-0000-0000-000000000030', relationId: 15650596, name: 'Mestia Cross Trail' },
  { id: 'a0000000-0000-0000-0000-000000000031', relationId: 14639513, name: 'Etseri to Bak Pass' },
  { id: 'a0000000-0000-0000-0000-000000000032', relationId: 15398157, name: 'Leiraki Waterfall Trail' },
  { id: 'a0000000-0000-0000-0000-000000000033', relationId: 15913814, name: 'Shuano Mountain Trail' },
  { id: 'a0000000-0000-0000-0000-000000000034', relationId: 15913873, name: 'Gvirgvina Mountain Trail' },

  // === TUSHETI ===
  { id: 'a0000000-0000-0000-0000-000000000035', relationId: 3817760, name: 'Atsunta Pass (Omalo to Shatili)' },
  { id: 'a0000000-0000-0000-0000-000000000036', relationId: 12211128, name: 'Omalo to Diklo' },
  { id: 'a0000000-0000-0000-0000-000000000037', relationId: 12211175, name: 'Omalo Round Trail' },
  { id: 'a0000000-0000-0000-0000-000000000038', relationId: 13316316, name: 'Diklo to Dartlo Red Trail' },
  { id: 'a0000000-0000-0000-0000-000000000039', relationId: 10485517, name: 'Omalo to Nakle Kholi Pass' },
  { id: 'a0000000-0000-0000-0000-000000000040', relationId: 10506208, name: 'Oreti Lake Hike' },

  // === KAZBEGI ===
  { id: 'a0000000-0000-0000-0000-000000000041', relationId: 14205880, name: 'Juta Waterfall and Lake' },
  { id: 'a0000000-0000-0000-0000-000000000042', relationId: 14224776, name: 'Arsha to Stepantsminda' },

  // === KAKHETI ===
  { id: 'a0000000-0000-0000-0000-000000000043', relationId: 10543211, name: 'Lagodekhi Black Rock Lake' },
  { id: 'a0000000-0000-0000-0000-000000000044', relationId: 10543228, name: 'Lagodekhi Yew Tree and Tbikeli Lake' },

  // === BORJOMI-KHARAGAULI ===
  { id: 'a0000000-0000-0000-0000-000000000045', relationId: 3740332, name: 'Borjomi Panorama Trail' },
  { id: 'a0000000-0000-0000-0000-000000000046', relationId: 3740333, name: 'St. Andrews Trail' },
  { id: 'a0000000-0000-0000-0000-000000000047', relationId: 3740346, name: 'Shepherds Trail' },
  { id: 'a0000000-0000-0000-0000-000000000048', relationId: 3740348, name: 'Pure Pristine Forest Trail' },
  { id: 'a0000000-0000-0000-0000-000000000049', relationId: 3740353, name: 'Following Wildlife Traces' },
  { id: 'a0000000-0000-0000-0000-000000000050', relationId: 5576945, name: 'Sairme Pass Trail' },

  // === TBILISI AREA ===
  { id: 'a0000000-0000-0000-0000-000000000051', relationId: 15081599, name: 'Mtatsminda to Narikala Fortress' },
  { id: 'a0000000-0000-0000-0000-000000000052', relationId: 14077975, name: 'Tbilisi National Park Trail' },
  { id: 'a0000000-0000-0000-0000-000000000053', relationId: 15658326, name: 'Mtatsminda to Kojori' },
  { id: 'a0000000-0000-0000-0000-000000000054', relationId: 15656924, name: 'Betania to Kveseti' },
  { id: 'a0000000-0000-0000-0000-000000000055', relationId: 15656937, name: 'Kiketi to Kabeni Monastery' },
  { id: 'a0000000-0000-0000-0000-000000000056', relationId: 15656966, name: 'Kojori to Kabeni Monastery and Waterfalls' },
  { id: 'a0000000-0000-0000-0000-000000000057', relationId: 15407539, name: 'Kojori to Asureti' },
  { id: 'a0000000-0000-0000-0000-000000000058', relationId: 13712566, name: 'Akhaldaba to Betania Monastery' },
  { id: 'a0000000-0000-0000-0000-000000000059', relationId: 15095553, name: 'Armazi Fortress Trail' },
  { id: 'a0000000-0000-0000-0000-000000000060', relationId: 16098291, name: 'Didgori to Chili Lake' },
  { id: 'a0000000-0000-0000-0000-000000000061', relationId: 15656895, name: 'Khmala Mountain Trail' },
  { id: 'a0000000-0000-0000-0000-000000000062', relationId: 15656918, name: 'Tana Gorge Round Trail' },

  // === ADJARA ===
  { id: 'a0000000-0000-0000-0000-000000000063', relationId: 14078802, name: 'Gonio Cross Hike' },
  { id: 'a0000000-0000-0000-0000-000000000064', relationId: 15663075, name: 'Chakvistavi Trail' },
  { id: 'a0000000-0000-0000-0000-000000000065', relationId: 14884461, name: 'Gobroneti Circular Hike' },
  { id: 'a0000000-0000-0000-0000-000000000066', relationId: 14384533, name: 'Kintrishi Nature Reserve Trail' },
  { id: 'a0000000-0000-0000-0000-000000000067', relationId: 14384534, name: 'Kintrishi to Tbikeli Lake' },

  // === IMERETI ===
  { id: 'a0000000-0000-0000-0000-000000000068', relationId: 16050511, name: 'Kutaisi to Sataplia' },
  { id: 'a0000000-0000-0000-0000-000000000069', relationId: 6535360, name: 'Upper Krikhi Trail' },
  { id: 'a0000000-0000-0000-0000-000000000070', relationId: 6535373, name: 'Sadmeli to Ritseuli Trail' },
  { id: 'a0000000-0000-0000-0000-000000000071', relationId: 6535480, name: 'Chelishi Trail' },
  { id: 'a0000000-0000-0000-0000-000000000072', relationId: 18231305, name: 'Adjameti Trail Route 2' },
  { id: 'a0000000-0000-0000-0000-000000000073', relationId: 18611857, name: 'Adjameti Trail Route 3' },
  { id: 'a0000000-0000-0000-0000-000000000074', relationId: 18611858, name: 'Adjameti Trail Route 1' },

  // === SAMTSKHE-JAVAKHETI ===
  { id: 'a0000000-0000-0000-0000-000000000075', relationId: 15670216, name: 'Vardzia to Tmogvi Fortress' },
  { id: 'a0000000-0000-0000-0000-000000000076', relationId: 19282454, name: 'Abastumani to Jaji Lake' },
  { id: 'a0000000-0000-0000-0000-000000000077', relationId: 19282624, name: 'Kartsachi Lake Trail' },
  { id: 'a0000000-0000-0000-0000-000000000078', relationId: 19305836, name: 'Jaji Lake to Ukhuti' },
  { id: 'a0000000-0000-0000-0000-000000000079', relationId: 19307461, name: 'Baratkhevi Trail' },

  // === RACHA / LECHKHUMI ===
  { id: 'a0000000-0000-0000-0000-000000000080', relationId: 15412627, name: 'Zeskho to Ghebi' },
  { id: 'a0000000-0000-0000-0000-000000000081', relationId: 15412745, name: 'Kelida Pass Trail' },
  { id: 'a0000000-0000-0000-0000-000000000082', relationId: 15413515, name: 'Kalitsadi Lake Trail' },
  { id: 'a0000000-0000-0000-0000-000000000083', relationId: 17571018, name: 'Shaori Reservoir Trail' },
  { id: 'a0000000-0000-0000-0000-000000000084', relationId: 19024909, name: 'Khvamli Mountain Trail' },

  // === SAMEGRELO ===
  { id: 'a0000000-0000-0000-0000-000000000085', relationId: 12411378, name: 'Kuakantsalia Trail' },

  // === PANKISI / KAKHETI ===
  { id: 'a0000000-0000-0000-0000-000000000086', relationId: 14195682, name: 'Khadori to Makhvali Waterfall' },

  // === TCT SEGMENTS ===
  { id: 'a0000000-0000-0000-0000-000000000087', relationId: 13703281, name: 'TCT: Chuberi to Nakra' },
  { id: 'a0000000-0000-0000-0000-000000000088', relationId: 13703282, name: 'TCT: Nakra to Becho' },
  { id: 'a0000000-0000-0000-0000-000000000089', relationId: 13703283, name: 'TCT: Becho to Mestia' },
  { id: 'a0000000-0000-0000-0000-000000000090', relationId: 14995924, name: 'TCT: Imereti to Racha' },

  // === OTHER ===
  { id: 'a0000000-0000-0000-0000-000000000091', relationId: 18187273, name: 'Tsriokhi Fortress Trail' },
  { id: 'a0000000-0000-0000-0000-000000000092', relationId: 18193774, name: 'Trail to Gorijvari' },
  { id: 'a0000000-0000-0000-0000-000000000093', relationId: 18234609, name: 'Gorinamkali Trail' },
  { id: 'a0000000-0000-0000-0000-000000000094', relationId: 15429964, name: 'Gogrulta Birkni Trail' },
  { id: 'a0000000-0000-0000-0000-000000000095', relationId: 15413585, name: 'Mount Borbalo Trail' },
  { id: 'a0000000-0000-0000-0000-000000000096', relationId: 15656855, name: 'Mokoland Trail' },
  { id: 'a0000000-0000-0000-0000-000000000097', relationId: 19253361, name: 'Cross Mountain Trail' },
  { id: 'a0000000-0000-0000-0000-000000000098', relationId: 18160416, name: 'Shepherds Trail by Ridge' },
  { id: 'a0000000-0000-0000-0000-000000000099', relationId: 12354329, name: 'Mukhuri to Khaishi' },
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
          if (data.includes('rate_limited') || data.includes('Too Many Requests') || data.includes('try again') || data.includes('runtime error') || data.includes('Gateway')) {
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
      if ((e.message === 'RATE_LIMITED' || e.message.includes('Parse error')) && i < maxRetries - 1) {
        const waitSec = (i + 1) * 25;
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
  console.log(`\n--- [${trail.id.slice(-2)}] ${trail.name} (relation ${trail.relationId}) ---`);

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
  console.log(`Fetching ${NEW_TRAILS.length} new trail routes from OSM...\n`);

  // Check for partial progress
  const outputPath = path.join(__dirname, 'new_routes.json');
  let existingResults = { found: [], notFound: [] };
  const processedIds = new Set();

  if (fs.existsSync(outputPath)) {
    try {
      existingResults = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      for (const r of existingResults.found) processedIds.add(r.id);
      for (const r of existingResults.notFound) processedIds.add(r.id);
      console.log(`Resuming: ${processedIds.size} trails already processed\n`);
    } catch (e) {
      console.log('Could not read existing results, starting fresh\n');
    }
  }

  const found = [...existingResults.found];
  const notFoundIds = new Set(existingResults.notFound.map(r => r.id));
  let fetchCount = 0;

  for (let i = 0; i < NEW_TRAILS.length; i++) {
    const trail = NEW_TRAILS[i];

    if (processedIds.has(trail.id)) {
      continue; // Skip already processed
    }

    const result = await processTrail(trail);

    if (result) {
      found.push({
        id: result.id,
        name: result.name,
        rawCount: result.rawCount,
        simplifiedCount: result.coords.length,
        start: { lon: result.coords[0][0], lat: result.coords[0][1] },
        end: { lon: result.coords[result.coords.length-1][0], lat: result.coords[result.coords.length-1][1] },
        coordinates: result.coords,
      });
    } else {
      notFoundIds.add(trail.id);
    }

    fetchCount++;

    // Save progress after every trail
    const notFoundList = NEW_TRAILS.filter(t => notFoundIds.has(t.id)).map(t => ({ id: t.id, name: t.name }));
    fs.writeFileSync(outputPath, JSON.stringify({ found, notFound: notFoundList }, null, 2));

    // Rate limit delay
    if (i < NEW_TRAILS.length - 1 && !processedIds.has(NEW_TRAILS[i+1]?.id)) {
      const delay = fetchCount % 5 === 0 ? 20000 : 12000;
      console.log(`  Waiting ${delay/1000}s...`);
      await sleep(delay);
    }
  }

  // Final summary
  const notFoundList = NEW_TRAILS.filter(t => notFoundIds.has(t.id)).map(t => ({ id: t.id, name: t.name }));
  fs.writeFileSync(outputPath, JSON.stringify({ found, notFound: notFoundList }, null, 2));

  console.log('\n\n=== FINAL SUMMARY ===');
  console.log(`Found: ${found.length}/${NEW_TRAILS.length}`);
  found.forEach(r => console.log(`  OK ${r.name}: ${r.simplifiedCount} points`));
  if (notFoundList.length > 0) {
    console.log(`Failed (${notFoundList.length}):`);
    notFoundList.forEach(t => console.log(`  FAIL ${t.name}`));
  }
  console.log(`\nSaved to ${outputPath}`);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
