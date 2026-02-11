/**
 * Fetch GPS coordinates from OSM for trails that are missing route data.
 * Searches by trail name in Georgia, then fetches full coordinates.
 * Resumable - saves progress after each trail.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, 'missing_routes.json');

// The 43 trails missing GPS data (from rebuild-seed-v2.js SKIP output)
const MISSING_TRAILS = [
  { id: '057', name: 'Kojori to Asureti', region: 'Tbilisi' },
  { id: '058', name: 'Akhaldaba to Betania Monastery', region: 'Tbilisi' },
  { id: '059', name: 'Armazi Fortress Trail', region: 'Tbilisi' },
  { id: '060', name: 'Didgori to Chili Lake', region: 'Tbilisi' },
  { id: '061', name: 'Khmala Mountain Trail', region: 'Tbilisi' },
  { id: '062', name: 'Tana Gorge Round Trail', region: 'Tbilisi' },
  { id: '063', name: 'Gonio Cross Hike', region: 'Adjara' },
  { id: '064', name: 'Chakvistavi Trail', region: 'Adjara' },
  { id: '065', name: 'Gobroneti Circular Hike', region: 'Adjara' },
  { id: '066', name: 'Kintrishi Nature Reserve Trail', region: 'Adjara' },
  { id: '067', name: 'Kintrishi to Tbikeli Lake', region: 'Adjara' },
  { id: '068', name: 'Kutaisi to Sataplia', region: 'Imereti' },
  { id: '069', name: 'Upper Krikhi Trail', region: 'Imereti' },
  { id: '070', name: 'Sadmeli to Ritseuli Trail', region: 'Imereti' },
  { id: '071', name: 'Chelishi Trail', region: 'Imereti' },
  { id: '072', name: 'Adjameti Trail Route 2', region: 'Imereti' },
  { id: '073', name: 'Adjameti Trail Route 3', region: 'Imereti' },
  { id: '074', name: 'Adjameti Trail Route 1', region: 'Imereti' },
  { id: '075', name: 'Vardzia to Tmogvi Fortress', region: 'Samtskhe-Javakheti' },
  { id: '076', name: 'Abastumani to Jaji Lake', region: 'Samtskhe-Javakheti' },
  { id: '077', name: 'Kartsachi Lake Trail', region: 'Samtskhe-Javakheti' },
  { id: '078', name: 'Jaji Lake to Ukhuti', region: 'Samtskhe-Javakheti' },
  { id: '079', name: 'Baratkhevi Trail', region: 'Samtskhe-Javakheti' },
  { id: '080', name: 'Zeskho to Ghebi', region: 'Racha' },
  { id: '081', name: 'Kelida Pass Trail', region: 'Racha' },
  { id: '082', name: 'Kalitsadi Lake Trail', region: 'Racha' },
  { id: '083', name: 'Shaori Reservoir Trail', region: 'Racha' },
  { id: '084', name: 'Khvamli Mountain Trail', region: 'Racha' },
  { id: '085', name: 'Kuakantsalia Trail', region: 'Samegrelo' },
  { id: '086', name: 'Khadori to Makhvali Waterfall', region: 'Kakheti' },
  { id: '087', name: 'TCT: Chuberi to Nakra', region: 'Svaneti' },
  { id: '088', name: 'TCT: Nakra to Becho', region: 'Svaneti' },
  { id: '089', name: 'TCT: Becho to Mestia', region: 'Svaneti' },
  { id: '090', name: 'TCT: Imereti to Racha', region: 'Racha' },
  { id: '091', name: 'Tsriokhi Fortress Trail', region: 'Imereti' },
  { id: '092', name: 'Trail to Gorijvari', region: 'Shida Kartli' },
  { id: '093', name: 'Gorinamkali Trail', region: 'Imereti' },
  { id: '094', name: 'Gogrulta Birkni Trail', region: 'Racha' },
  { id: '095', name: 'Mount Borbalo Trail', region: 'Racha' },
  { id: '096', name: 'Mokoland Trail', region: 'Tbilisi' },
  { id: '097', name: 'Cross Mountain Trail', region: 'Imereti' },
  { id: '098', name: 'Shepherds Trail by Ridge', region: 'Borjomi-Kharagauli' },
  { id: '099', name: 'Mukhuri to Khaishi', region: 'Samegrelo' },
];

// Region bounding boxes for search area [south, west, north, east]
const REGION_BBOX = {
  'Tbilisi': [41.5, 44.0, 42.0, 45.2],
  'Adjara': [41.3, 41.5, 41.9, 42.8],
  'Imereti': [41.8, 42.0, 42.6, 43.5],
  'Samtskhe-Javakheti': [41.0, 42.5, 42.0, 44.0],
  'Racha': [42.0, 42.5, 42.9, 44.3],
  'Samegrelo': [42.0, 41.5, 42.7, 42.5],
  'Svaneti': [42.5, 41.5, 43.3, 43.5],
  'Kakheti': [41.3, 45.0, 42.5, 46.5],
  'Shida Kartli': [41.7, 43.5, 42.3, 44.5],
  'Borjomi-Kharagauli': [41.5, 43.0, 42.1, 44.0],
  'Georgia': [41.0, 40.0, 43.5, 46.8],
};

// Alternative search terms for trails that might not match by name
const ALT_NAMES = {
  'Kojori to Asureti': ['Kojori Asureti'],
  'Gonio Cross Hike': ['Gonio cross', 'Gonio trail'],
  'Chakvistavi Trail': ['Chakvistavi'],
  'Gobroneti Circular Hike': ['Gobroneti'],
  'Kutaisi to Sataplia': ['Sataplia'],
  'TCT: Chuberi to Nakra': ['Transcaucasian Trail Chuberi', 'TCT Chuberi'],
  'TCT: Nakra to Becho': ['Transcaucasian Trail Nakra', 'TCT Nakra'],
  'TCT: Becho to Mestia': ['Transcaucasian Trail Becho', 'TCT Becho'],
  'TCT: Imereti to Racha': ['Transcaucasian Trail Imereti', 'TCT Imereti'],
  'Trail to Gorijvari': ['Gorijvari'],
  'Gorinamkali Trail': ['Gorinamkali'],
  'Mokoland Trail': ['Mokoland', 'Moko land'],
  'Cross Mountain Trail': ['Cross Mountain'],
  'Shepherds Trail by Ridge': ['Shepherds Trail Ridge', 'Shepherd Ridge'],
  'Mukhuri to Khaishi': ['Mukhuri Khaishi'],
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'GeorgiaTrailsApp/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(data);
        else reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
      });
    }).on('error', reject);
  });
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'GeorgiaTrailsApp/1.0',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(data);
        else reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function searchTrailOnOSM(name, region) {
  const bbox = REGION_BBOX[region] || REGION_BBOX['Georgia'];
  const [s, w, n, e] = bbox;

  // Try different search strategies
  const searchTerms = [name, ...(ALT_NAMES[name] || [])];

  for (const term of searchTerms) {
    // Strategy 1: Search for hiking routes by name
    const query = `
      [out:json][timeout:30];
      (
        relation["route"~"hiking|foot"]["name"~"${term.replace(/['"]/g, '')}", i](${s},${w},${n},${e});
        way["highway"~"path|track|footway"]["name"~"${term.replace(/['"]/g, '')}", i](${s},${w},${n},${e});
      );
      out body;
    `;

    try {
      const result = await httpPost('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(query)}`);
      const data = JSON.parse(result);

      if (data.elements && data.elements.length > 0) {
        // Prefer relations over ways
        const relations = data.elements.filter(e => e.type === 'relation');
        const ways = data.elements.filter(e => e.type === 'way');
        const best = relations.length > 0 ? relations[0] : ways[0];
        console.log(`  Found "${term}" as ${best.type} ${best.id} (${best.tags?.name || 'unnamed'})`);
        return best;
      }
    } catch (err) {
      if (err.message.includes('429') || err.message.includes('Too many')) {
        console.log('  Rate limited, waiting 30s...');
        await sleep(30000);
        continue;
      }
      console.log(`  Search error for "${term}": ${err.message.substring(0, 80)}`);
    }
    await sleep(2000);
  }

  // Strategy 2: Search using Nominatim as fallback
  for (const term of searchTerms) {
    try {
      const encoded = encodeURIComponent(`${term} Georgia hiking`);
      const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&countrycodes=ge&limit=3`;
      const result = await httpGet(url);
      const results = JSON.parse(result);

      if (results.length > 0) {
        const match = results.find(r => r.osm_type === 'relation') || results[0];
        console.log(`  Nominatim found "${term}" -> ${match.osm_type} ${match.osm_id} (${match.display_name.substring(0, 60)})`);
        return { type: match.osm_type, id: parseInt(match.osm_id), source: 'nominatim' };
      }
    } catch (err) {
      console.log(`  Nominatim error: ${err.message.substring(0, 60)}`);
    }
    await sleep(1500);
  }

  return null;
}

async function fetchRouteCoords(element) {
  let query;

  if (element.type === 'relation') {
    query = `
      [out:json][timeout:60];
      relation(${element.id});
      (._;>;);
      out body;
    `;
  } else if (element.type === 'way') {
    query = `
      [out:json][timeout:30];
      way(${element.id});
      (._;>;);
      out body;
    `;
  } else if (element.source === 'nominatim' && element.type === 'node') {
    // For nodes, return single point
    return null;
  } else {
    // Try as relation from nominatim
    query = `
      [out:json][timeout:60];
      ${element.type === 'way' ? 'way' : 'relation'}(${element.id});
      (._;>;);
      out body;
    `;
  }

  const result = await httpPost('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(query)}`);
  const data = JSON.parse(result);

  const nodes = new Map();
  for (const el of data.elements) {
    if (el.type === 'node') {
      nodes.set(el.id, [el.lon, el.lat]);
    }
  }

  let coords = [];

  if (element.type === 'relation') {
    const relation = data.elements.find(e => e.type === 'relation');
    if (!relation) return null;

    // Build ordered route from way members
    const ways = data.elements.filter(e => e.type === 'way');
    const wayMap = new Map();
    for (const w of ways) wayMap.set(w.id, w);

    for (const member of relation.members || []) {
      if (member.type === 'way') {
        const way = wayMap.get(member.ref);
        if (way && way.nodes) {
          const wayCoords = way.nodes.map(nid => nodes.get(nid)).filter(Boolean);
          coords.push(...wayCoords);
        }
      }
    }
  } else {
    // Way
    const way = data.elements.find(e => e.type === 'way');
    if (way && way.nodes) {
      coords = way.nodes.map(nid => nodes.get(nid)).filter(Boolean);
    }
  }

  if (coords.length < 2) return null;

  // Deduplicate consecutive identical points
  const deduped = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    if (coords[i][0] !== coords[i - 1][0] || coords[i][1] !== coords[i - 1][1]) {
      deduped.push(coords[i]);
    }
  }

  // Simplify to max 300 points
  let simplified = deduped;
  if (deduped.length > 300) {
    const step = deduped.length / 300;
    simplified = [];
    for (let i = 0; i < 300; i++) {
      simplified.push(deduped[Math.min(Math.floor(i * step), deduped.length - 1)]);
    }
    if (simplified[simplified.length - 1] !== deduped[deduped.length - 1]) {
      simplified.push(deduped[deduped.length - 1]);
    }
  }

  return {
    coords: simplified,
    start: simplified[0],
    end: simplified[simplified.length - 1],
    totalPoints: deduped.length,
    simplifiedPoints: simplified.length,
  };
}

async function main() {
  // Load existing progress
  let results = { found: [], notFound: [] };
  if (fs.existsSync(OUTPUT_FILE)) {
    results = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    console.log(`Resuming: ${results.found.length} found, ${results.notFound.length} not found`);
  }

  const processed = new Set([
    ...results.found.map(r => r.trailId),
    ...results.notFound.map(r => r.trailId),
  ]);

  const remaining = MISSING_TRAILS.filter(t => !processed.has(t.id));
  console.log(`${remaining.length} trails remaining to process\n`);

  for (let i = 0; i < remaining.length; i++) {
    const trail = remaining[i];
    console.log(`[${i + 1}/${remaining.length}] Searching: ${trail.name} (${trail.region})`);

    const element = await searchTrailOnOSM(trail.name, trail.region);

    if (!element) {
      console.log(`  NOT FOUND on OSM\n`);
      results.notFound.push({ trailId: trail.id, name: trail.name, region: trail.region });
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
      await sleep(3000);
      continue;
    }

    // Fetch coordinates
    console.log(`  Fetching coordinates...`);
    await sleep(3000); // Rate limiting

    try {
      const routeData = await fetchRouteCoords(element);

      if (routeData && routeData.coords.length >= 2) {
        console.log(`  SUCCESS: ${routeData.simplifiedPoints} waypoints (${routeData.totalPoints} total)\n`);
        results.found.push({
          trailId: trail.id,
          name: trail.name,
          region: trail.region,
          osmType: element.type,
          osmId: element.id,
          coords: routeData.coords,
          start: routeData.start,
          end: routeData.end,
          totalPoints: routeData.totalPoints,
          simplifiedPoints: routeData.simplifiedPoints,
        });
      } else {
        console.log(`  Found element but no valid coordinates\n`);
        results.notFound.push({ trailId: trail.id, name: trail.name, region: trail.region, osmType: element.type, osmId: element.id });
      }
    } catch (err) {
      console.log(`  Fetch error: ${err.message.substring(0, 80)}\n`);
      if (err.message.includes('429') || err.message.includes('Too many')) {
        console.log('  Rate limited, waiting 60s...');
        await sleep(60000);
        i--; // Retry this trail
        continue;
      }
      results.notFound.push({ trailId: trail.id, name: trail.name, region: trail.region, error: err.message.substring(0, 100) });
    }

    // Save progress after each trail
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    await sleep(5000); // Be nice to the API
  }

  console.log(`\n=== DONE ===`);
  console.log(`Found: ${results.found.length}`);
  console.log(`Not found: ${results.notFound.length}`);
  console.log(`Total: ${results.found.length + results.notFound.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
