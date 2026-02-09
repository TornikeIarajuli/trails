/**
 * Fetches Georgian hiking routes from OpenStreetMap Overpass API
 * and generates seed SQL with real route geometry + test users.
 *
 * Usage: npx ts-node scripts/fetch-routes.ts
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Known Georgian hiking trails we want to match from OSM
const TRAIL_QUERIES = [
  { name: 'Gergeti Trinity Church', osmName: 'Gergeti', region: 'Kazbegi', bbox: '42.64,44.60,42.68,44.64' },
  { name: 'Mestia to Ushguli Trek', osmName: 'Ushguli', region: 'Svaneti', bbox: '42.85,42.70,43.10,42.95' },
  { name: 'Juta to Roshka (Abudelauri Lakes)', osmName: 'Abudelauri|Juta|Roshka', region: 'Kazbegi', bbox: '42.54,44.50,42.60,44.60' },
  { name: 'Truso Valley', osmName: 'Truso', region: 'Kazbegi', bbox: '42.52,44.45,42.60,44.60' },
  { name: 'Lagodekhi Waterfall Trail', osmName: 'Lagodekhi', region: 'Kakheti', bbox: '41.80,46.25,41.90,46.35' },
  { name: 'Shatili to Mutso', osmName: 'Shatili|Mutso', region: 'Khevsureti', bbox: '42.60,45.15,42.66,45.25' },
  { name: 'Borjomi-Kharagauli', osmName: 'Borjomi', region: 'Borjomi-Kharagauli', bbox: '41.75,43.30,41.90,43.45' },
  { name: 'Chaukhi Pass', osmName: 'Chaukhi', region: 'Kazbegi', bbox: '42.55,44.52,42.60,44.58' },
  { name: 'Omalo to Dartlo', osmName: 'Dartlo|Omalo', region: 'Tusheti', bbox: '42.37,45.55,42.43,45.65' },
  { name: 'Tobavarchkhili (Silver Lake)', osmName: 'Tobavarchkhili', region: 'Samegrelo', bbox: '42.48,42.05,42.58,42.18' },
  { name: 'Martvili Canyon Trail', osmName: 'Martvili', region: 'Samegrelo', bbox: '42.44,42.36,42.48,42.40' },
  { name: 'Okatse Canyon Trail', osmName: 'Okatse', region: 'Imereti', bbox: '42.37,42.42,42.40,42.46' },
];

interface Coordinate {
  lat: number;
  lon: number;
}

async function queryOverpass(query: string): Promise<any> {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  return res.json();
}

async function fetchHikingRoutes(): Promise<Map<string, Coordinate[]>> {
  console.log('Fetching all hiking routes in Georgia from OSM...');

  const query = `
    [out:json][timeout:60];
    area["name:en"="Georgia"]["admin_level"="2"]->.georgia;
    (
      relation["route"="hiking"](area.georgia);
      way["highway"="path"]["sac_scale"](area.georgia);
    );
    out body;
    >;
    out skel qt;
  `;

  const data = await queryOverpass(query);

  // Build node lookup
  const nodes = new Map<number, Coordinate>();
  for (const el of data.elements) {
    if (el.type === 'node' && el.lat && el.lon) {
      nodes.set(el.id, { lat: el.lat, lon: el.lon });
    }
  }

  // Extract way coordinates
  const ways = new Map<number, Coordinate[]>();
  for (const el of data.elements) {
    if (el.type === 'way' && el.nodes) {
      const coords: Coordinate[] = [];
      for (const nodeId of el.nodes) {
        const node = nodes.get(nodeId);
        if (node) coords.push(node);
      }
      if (coords.length > 1) ways.set(el.id, coords);
    }
  }

  // Extract relation routes
  const routes = new Map<string, Coordinate[]>();
  for (const el of data.elements) {
    if (el.type === 'relation' && el.tags?.name) {
      const coords: Coordinate[] = [];
      for (const member of el.members || []) {
        if (member.type === 'way') {
          const wayCoords = ways.get(member.ref);
          if (wayCoords) coords.push(...wayCoords);
        }
      }
      if (coords.length > 1) {
        routes.set(el.tags.name, coords);
      }
    }
  }

  console.log(`Found ${routes.size} named hiking routes`);
  return routes;
}

function findBestMatch(osmRoutes: Map<string, Coordinate[]>, searchTerms: string): Coordinate[] | null {
  const terms = searchTerms.split('|').map(t => t.toLowerCase());

  for (const [name, coords] of osmRoutes) {
    const lower = name.toLowerCase();
    if (terms.some(t => lower.includes(t))) {
      return coords;
    }
  }
  return null;
}

function simplifyRoute(coords: Coordinate[], maxPoints: number = 30): Coordinate[] {
  if (coords.length <= maxPoints) return coords;

  // Simple nth-point sampling
  const step = (coords.length - 1) / (maxPoints - 1);
  const result: Coordinate[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(coords[Math.round(i * step)]);
  }
  return result;
}

function coordsToSQL(coords: Coordinate[]): string {
  return coords.map(c => `ST_MakePoint(${c.lon.toFixed(6)}, ${c.lat.toFixed(6)})`).join(',\n        ');
}

async function main() {
  let osmRoutes: Map<string, Coordinate[]>;

  try {
    osmRoutes = await fetchHikingRoutes();
  } catch (e) {
    console.error('Failed to fetch from Overpass API, using enhanced coordinates');
    osmRoutes = new Map();
  }

  // For each trail, try to match OSM data or use enhanced manual coordinates
  const trailRoutes = new Map<string, Coordinate[]>();

  for (const trail of TRAIL_QUERIES) {
    const osmMatch = findBestMatch(osmRoutes, trail.osmName);
    if (osmMatch && osmMatch.length > 3) {
      console.log(`  ✓ ${trail.name}: matched OSM route (${osmMatch.length} points → simplified)`);
      trailRoutes.set(trail.name, simplifyRoute(osmMatch, 25));
    } else {
      console.log(`  ✗ ${trail.name}: no OSM match, using manual route`);
    }
  }

  // Generate the SQL
  generateSeedSQL(trailRoutes);
}

function generateSeedSQL(osmData: Map<string, Coordinate[]>) {
  // Enhanced trail data with more realistic route points (fallback if OSM fails)
  const trails = [
    {
      name_en: 'Gergeti Trinity Church',
      name_ka: 'გერგეტის სამება',
      desc_en: 'Iconic hike to the 14th-century Gergeti Trinity Church perched at 2,170m with stunning views of Mount Kazbek. The trail winds through alpine meadows with panoramic Caucasus views.',
      desc_ka: 'საგზაო ბილიკი XIV საუკუნის გერგეტის სამების ეკლესიამდე, რომელიც 2,170 მ სიმაღლეზე მდებარეობს.',
      difficulty: 'easy', region: 'Kazbegi', distance: 6.0, elevation: 500, hours: 2.5,
      cover: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=800',
      fallbackRoute: [
        {lat:42.6598,lon:44.6198},{lat:42.6605,lon:44.6190},{lat:42.6610,lon:44.6183},
        {lat:42.6614,lon:44.6178},{lat:42.6618,lon:44.6174},{lat:42.6620,lon:44.6170},
        {lat:42.6622,lon:44.6168},{lat:42.6625,lon:44.6164},{lat:42.6627,lon:44.6159},
      ],
    },
    {
      name_en: 'Mestia to Ushguli Trek',
      name_ka: 'მესტიიდან უშგულამდე ლაშქრობა',
      desc_en: 'Multi-day trek through the heart of Upper Svaneti, passing medieval Svan towers, glacier-fed rivers, and remote mountain villages. One of the most iconic treks in the Caucasus.',
      desc_ka: 'მრავალდღიანი ლაშქრობა ზემო სვანეთის გულში.',
      difficulty: 'hard', region: 'Svaneti', distance: 58.0, elevation: 3200, hours: 28.0,
      cover: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',
      fallbackRoute: [
        {lat:43.0453,lon:42.7275},{lat:43.0380,lon:42.7400},{lat:43.0290,lon:42.7550},
        {lat:43.0200,lon:42.7800},{lat:43.0100,lon:42.8000},{lat:42.9950,lon:42.8200},
        {lat:42.9800,lon:42.8400},{lat:42.9650,lon:42.8600},{lat:42.9500,lon:42.8800},
        {lat:42.9350,lon:42.9000},{lat:42.9200,lon:42.9275},
      ],
    },
    {
      name_en: 'Juta to Roshka (Abudelauri Lakes)',
      name_ka: 'ჯუთადან როშკამდე (აბუდელაურის ტბები)',
      desc_en: 'Spectacular high-alpine crossing via the colorful Abudelauri Lakes — blue, green, and white glacial lakes nestled at 3,000m. The trail crosses the Chaukhi Pass at 3,338m.',
      desc_ka: 'შთამბეჭდავი მაღალმთიანი გადასასვლელი ფერადი აბუდელაურის ტბებით.',
      difficulty: 'hard', region: 'Kazbegi', distance: 26.0, elevation: 1800, hours: 10.0,
      cover: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
      fallbackRoute: [
        {lat:42.5788,lon:44.5752},{lat:42.5760,lon:44.5720},{lat:42.5735,lon:44.5680},
        {lat:42.5710,lon:44.5640},{lat:42.5690,lon:44.5600},{lat:42.5670,lon:44.5560},
        {lat:42.5640,lon:44.5520},{lat:42.5600,lon:44.5460},{lat:42.5560,lon:44.5380},
        {lat:42.5520,lon:44.5300},{lat:42.5500,lon:44.5200},
      ],
    },
    {
      name_en: 'Omalo to Dartlo',
      name_ka: 'ომალოდან დართლომდე',
      desc_en: 'Beautiful day hike through the remote Tusheti region, connecting two medieval fortress villages through pine forests and open valleys with views of the Greater Caucasus.',
      desc_ka: 'ლამაზი ერთდღიანი ლაშქრობა შორეულ თუშეთის რეგიონში.',
      difficulty: 'medium', region: 'Tusheti', distance: 14.0, elevation: 650, hours: 5.0,
      cover: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800',
      fallbackRoute: [
        {lat:42.3933,lon:45.6325},{lat:42.3950,lon:45.6280},{lat:42.3970,lon:45.6220},
        {lat:42.3990,lon:45.6160},{lat:42.4010,lon:45.6100},{lat:42.4030,lon:45.6040},
        {lat:42.4060,lon:45.5960},{lat:42.4080,lon:45.5900},{lat:42.4100,lon:45.5850},
      ],
    },
    {
      name_en: 'Truso Valley',
      name_ka: 'თრუსოს ხეობა',
      desc_en: 'Scenic valley walk along the Terek River through dramatic gorges, past travertine mineral pools and abandoned villages. Ends at stunning travertine terraces near the Russian border.',
      desc_ka: 'სცენური ხეობის გასეირნება თერგის მდინარის გასწვრივ.',
      difficulty: 'easy', region: 'Kazbegi', distance: 24.0, elevation: 400, hours: 6.0,
      cover: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800',
      fallbackRoute: [
        {lat:42.5550,lon:44.5800},{lat:42.5570,lon:44.5720},{lat:42.5600,lon:44.5640},
        {lat:42.5630,lon:44.5550},{lat:42.5660,lon:44.5460},{lat:42.5690,lon:44.5370},
        {lat:42.5720,lon:44.5280},{lat:42.5760,lon:44.5100},{lat:42.5800,lon:44.4900},
      ],
    },
    {
      name_en: 'Lagodekhi Waterfall Trail',
      name_ka: 'ლაგოდეხის ჩანჩქერის ბილიკი',
      desc_en: 'Easy nature walk through pristine old-growth forest in Lagodekhi Protected Areas to a beautiful waterfall. Rich biodiversity with rare plants and bird species.',
      desc_ka: 'მარტივი ბუნების გასეირნება ლაგოდეხის დაცულ ტერიტორიაში.',
      difficulty: 'easy', region: 'Kakheti', distance: 14.0, elevation: 300, hours: 4.0,
      cover: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800',
      fallbackRoute: [
        {lat:41.8280,lon:46.2840},{lat:41.8310,lon:46.2870},{lat:41.8340,lon:46.2910},
        {lat:41.8370,lon:46.2950},{lat:41.8400,lon:46.2990},{lat:41.8430,lon:46.3020},
        {lat:41.8460,lon:46.3060},{lat:41.8500,lon:46.3100},
      ],
    },
    {
      name_en: 'Borjomi-Kharagauli: Likani Trail',
      name_ka: 'ბორჯომ-ხარაგაული: ლიკანის ბილიკი',
      desc_en: 'Day hike in one of Europe\'s largest national parks. The trail climbs from Borjomi\'s famous spa town through mixed forests to alpine meadows with panoramic views.',
      desc_ka: 'ერთდღიანი ლაშქრობა ევროპის ერთ-ერთ უდიდეს ეროვნულ პარკში.',
      difficulty: 'medium', region: 'Borjomi-Kharagauli', distance: 18.0, elevation: 1100, hours: 7.0,
      cover: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800',
      fallbackRoute: [
        {lat:41.8370,lon:43.4060},{lat:41.8340,lon:43.4010},{lat:41.8310,lon:43.3950},
        {lat:41.8270,lon:43.3880},{lat:41.8230,lon:43.3800},{lat:41.8190,lon:43.3720},
        {lat:41.8150,lon:43.3630},{lat:41.8100,lon:43.3500},
      ],
    },
    {
      name_en: 'Chaukhi Pass',
      name_ka: 'ჩაუხის უღელტეხილი',
      desc_en: 'Challenging high-altitude pass crossing at 3,338m between Juta and Roshka valleys. The Chaukhi massif towers above with dramatic rock spires.',
      desc_ka: 'რთული მაღალმთიანი უღელტეხილის გადალახვა 3,338 მ-ზე.',
      difficulty: 'ultra', region: 'Kazbegi', distance: 16.0, elevation: 1500, hours: 9.0,
      cover: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800',
      fallbackRoute: [
        {lat:42.5780,lon:44.5750},{lat:42.5765,lon:44.5720},{lat:42.5750,lon:44.5690},
        {lat:42.5738,lon:44.5660},{lat:42.5725,lon:44.5630},{lat:42.5710,lon:44.5590},
        {lat:42.5695,lon:44.5550},{lat:42.5680,lon:44.5500},{lat:42.5665,lon:44.5440},
        {lat:42.5650,lon:44.5350},
      ],
    },
    {
      name_en: 'Martvili Canyon Trail',
      name_ka: 'მარტვილის კანიონის ბილიკი',
      desc_en: 'Short but stunning walk along the turquoise Abasha River canyon. Includes walkways carved into the cliff face and a boat ride through the narrow upper canyon.',
      desc_ka: 'მოკლე, მაგრამ შთამბეჭდავი გასეირნება აბაშის მდინარის კანიონის გასწვრივ.',
      difficulty: 'easy', region: 'Samegrelo', distance: 3.0, elevation: 50, hours: 1.0,
      cover: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800',
      fallbackRoute: [
        {lat:42.4560,lon:42.3780},{lat:42.4568,lon:42.3790},{lat:42.4575,lon:42.3800},
        {lat:42.4582,lon:42.3810},{lat:42.4590,lon:42.3820},
      ],
    },
    {
      name_en: 'Okatse Canyon Trail',
      name_ka: 'ოკაცეს კანიონის ბილიკი',
      desc_en: 'Thrilling walk on a metal walkway suspended over the 100m deep Okatse Canyon. The trail leads through dense forest to the hanging bridge and viewing platforms.',
      desc_ka: 'საინტერესო გასეირნება ლითონის ბილიკზე ოკაცეს კანიონზე.',
      difficulty: 'easy', region: 'Imereti', distance: 7.0, elevation: 200, hours: 2.5,
      cover: 'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800',
      fallbackRoute: [
        {lat:42.3850,lon:42.4340},{lat:42.3865,lon:42.4360},{lat:42.3880,lon:42.4380},
        {lat:42.3895,lon:42.4400},{lat:42.3910,lon:42.4430},{lat:42.3920,lon:42.4450},
      ],
    },
    {
      name_en: 'Shatili to Mutso',
      name_ka: 'შატილიდან მუწომდე',
      desc_en: 'Remote trek in the wild Khevsureti region connecting two spectacular medieval fortress villages through the dramatic Argun Gorge.',
      desc_ka: 'შორეული ლაშქრობა ხევსურეთის ველურ რეგიონში.',
      difficulty: 'hard', region: 'Khevsureti', distance: 12.0, elevation: 800, hours: 5.0,
      cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800',
      fallbackRoute: [
        {lat:42.6250,lon:45.1750},{lat:42.6270,lon:45.1800},{lat:42.6290,lon:45.1860},
        {lat:42.6310,lon:45.1920},{lat:42.6330,lon:45.1980},{lat:42.6350,lon:45.2030},
        {lat:42.6380,lon:45.2060},{lat:42.6400,lon:45.2100},
      ],
    },
    {
      name_en: 'Tobavarchkhili (Silver Lake)',
      name_ka: 'ტობავარჩხილი (ვერცხლის ტბა)',
      desc_en: 'Multi-day expedition to the legendary Silver Lake, hidden deep in the remote forests west of Kutaisi. Dense forests, river crossings, and wild camping.',
      desc_ka: 'მრავალდღიანი ექსპედიცია ლეგენდარულ ვერცხლის ტბამდე.',
      difficulty: 'ultra', region: 'Samegrelo', distance: 44.0, elevation: 2800, hours: 24.0,
      cover: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      fallbackRoute: [
        {lat:42.5200,lon:42.1500},{lat:42.5240,lon:42.1420},{lat:42.5280,lon:42.1340},
        {lat:42.5320,lon:42.1260},{lat:42.5360,lon:42.1180},{lat:42.5400,lon:42.1100},
        {lat:42.5440,lon:42.1020},{lat:42.5490,lon:42.0940},{lat:42.5540,lon:42.0860},
        {lat:42.5600,lon:42.0800},
      ],
    },
  ];

  // Use fixed UUIDs for trails so we can reference them in completions
  const trailIds = trails.map((_, i) => `'a0000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}'`);

  // Test user UUIDs
  const testUsers = [
    { id: 'b0000000-0000-0000-0000-000000000001', username: 'mountain_nika', name: 'Nika Gelashvili', bio: 'Mountain enthusiast from Tbilisi. Conquered 50+ peaks across the Caucasus.' },
    { id: 'b0000000-0000-0000-0000-000000000002', username: 'hiking_mari', name: 'Mariam Kvaratskhelia', bio: 'Nature photographer and trail runner. Svaneti is my second home.' },
    { id: 'b0000000-0000-0000-0000-000000000003', username: 'george_adventures', name: 'Giorgi Beridze', bio: 'Weekend warrior. Exploring every corner of Georgia one trail at a time.' },
    { id: 'b0000000-0000-0000-0000-000000000004', username: 'tea_on_trail', name: 'Teona Mikadze', bio: 'Slow hiker, fast photographer. Always carry tea to the summit.' },
  ];

  let sql = `-- ============================================
-- SEED DATA: Georgian Hiking Trails
-- Generated with real route data from OpenStreetMap
-- ============================================

-- Clean existing data
TRUNCATE trail_reviews, trail_completions, checkpoint_completions, trail_checkpoints, trail_media, trails CASCADE;

`;

  // Insert trails with fixed UUIDs
  for (let i = 0; i < trails.length; i++) {
    const t = trails[i];
    const route = osmData.get(t.name_en) || t.fallbackRoute;
    const start = route[0];
    const end = route[route.length - 1];

    const desc_en = t.desc_en.replace(/'/g, "''");
    const desc_ka = t.desc_ka.replace(/'/g, "''");

    sql += `INSERT INTO trails (id, name_en, name_ka, description_en, description_ka, difficulty, region, distance_km, elevation_gain_m, estimated_hours, start_point, end_point, route, cover_image_url, is_published) VALUES (
    ${trailIds[i]},
    '${t.name_en.replace(/'/g, "''")}',
    '${t.name_ka}',
    '${desc_en}',
    '${desc_ka}',
    '${t.difficulty}',
    '${t.region}',
    ${t.distance}, ${t.elevation}, ${t.hours},
    ST_SetSRID(ST_MakePoint(${start.lon.toFixed(6)}, ${start.lat.toFixed(6)}), 4326),
    ST_SetSRID(ST_MakePoint(${end.lon.toFixed(6)}, ${end.lat.toFixed(6)}), 4326),
    ST_SetSRID(ST_MakeLine(ARRAY[
        ${route.map(c => `ST_MakePoint(${c.lon.toFixed(6)}, ${c.lat.toFixed(6)})`).join(',\n        ')}
    ]), 4326),
    '${t.cover}',
    true
);\n\n`;
  }

  // Trail media
  sql += `-- ============================================\n-- TRAIL MEDIA\n-- ============================================\n`;
  const unsplashPhotos = [
    'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=600',
    'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
    'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600',
    'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=600',
    'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=600',
    'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
    'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=600',
    'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600',
    'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=600',
  ];

  for (let i = 0; i < trails.length; i++) {
    for (let j = 0; j < 3; j++) {
      const photoIdx = (i + j) % unsplashPhotos.length;
      sql += `INSERT INTO trail_media (trail_id, type, url, caption, sort_order) VALUES (${trailIds[i]}, 'photo', '${unsplashPhotos[photoIdx]}', '${trails[i].name_en} - Photo ${j + 1}', ${j});\n`;
    }
  }

  // Checkpoints
  sql += `\n-- ============================================\n-- TRAIL CHECKPOINTS\n-- ============================================\n`;
  const checkpointTypes = ['viewpoint', 'landmark', 'water_source', 'church', 'lake', 'waterfall', 'summit', 'bridge', 'ruins', 'pass'];

  for (let i = 0; i < trails.length; i++) {
    const route = osmData.get(trails[i].name_en) || trails[i].fallbackRoute;
    const numCheckpoints = Math.min(3, Math.max(2, Math.floor(route.length / 3)));

    for (let c = 0; c < numCheckpoints; c++) {
      const ptIdx = Math.floor((c + 1) * route.length / (numCheckpoints + 1));
      const pt = route[Math.min(ptIdx, route.length - 1)];
      const cpType = checkpointTypes[(i + c) % checkpointTypes.length];
      const cpName = `${trails[i].name_en} - Checkpoint ${c + 1}`;

      sql += `INSERT INTO trail_checkpoints (trail_id, name_en, type, coordinates, sort_order, is_checkable) VALUES (${trailIds[i]}, '${cpName}', '${cpType}', ST_SetSRID(ST_MakePoint(${pt.lon.toFixed(6)}, ${pt.lat.toFixed(6)}), 4326), ${c}, true);\n`;
    }
  }

  // Test users - create via Supabase auth admin API, then insert profiles
  sql += `\n-- ============================================
-- TEST USERS (profiles only — auth users created via API)
-- To create auth users, run: node scripts/create-test-users.js
-- ============================================
`;

  for (const u of testUsers) {
    sql += `INSERT INTO profiles (id, username, full_name, bio, total_trails_completed)
VALUES ('${u.id}', '${u.username}', '${u.name}', '${u.bio}', 0)
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, full_name = EXCLUDED.full_name, bio = EXCLUDED.bio;\n`;
  }

  // Trail completions for test users
  sql += `\n-- ============================================\n-- TRAIL COMPLETIONS\n-- ============================================\n`;

  const completionAssignments = [
    { userId: testUsers[0].id, trailIndices: [0, 1, 2, 4, 7, 10], count: 6 },  // Nika: 6 trails
    { userId: testUsers[1].id, trailIndices: [0, 1, 3, 5, 8], count: 5 },       // Mari: 5 trails
    { userId: testUsers[2].id, trailIndices: [0, 4, 9, 10], count: 4 },          // Giorgi: 4 trails
    { userId: testUsers[3].id, trailIndices: [0, 5, 6], count: 3 },              // Teona: 3 trails
  ];

  for (const assign of completionAssignments) {
    for (const tIdx of assign.trailIndices) {
      if (tIdx >= trails.length) continue;
      const route = osmData.get(trails[tIdx].name_en) || trails[tIdx].fallbackRoute;
      const midPt = route[Math.floor(route.length / 2)];
      const daysAgo = Math.floor(Math.random() * 180) + 1;
      sql += `INSERT INTO trail_completions (user_id, trail_id, proof_photo_url, photo_lat, photo_lng, status, completed_at)
VALUES ('${assign.userId}', ${trailIds[tIdx]}, 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400', ${midPt.lat.toFixed(7)}, ${midPt.lon.toFixed(7)}, 'approved', NOW() - INTERVAL '${daysAgo} days');\n`;
    }
    sql += `UPDATE profiles SET total_trails_completed = ${assign.count} WHERE id = '${assign.userId}';\n`;
  }

  // Reviews
  sql += `\n-- ============================================\n-- TRAIL REVIEWS\n-- ============================================\n`;
  const reviewComments = [
    'Amazing trail! The views are breathtaking.',
    'Well-maintained path, highly recommend.',
    'Challenging but rewarding. Bring plenty of water.',
    'One of the best hikes in Georgia!',
    'Beautiful scenery, moderate difficulty.',
    'Perfect weekend hike. Not too crowded.',
  ];

  for (const assign of completionAssignments) {
    for (let j = 0; j < Math.min(3, assign.trailIndices.length); j++) {
      const tIdx = assign.trailIndices[j];
      if (tIdx >= trails.length) continue;
      const rating = 4 + Math.floor(Math.random() * 2); // 4 or 5
      const comment = reviewComments[(j + assign.trailIndices[0]) % reviewComments.length];
      sql += `INSERT INTO trail_reviews (user_id, trail_id, rating, comment) VALUES ('${assign.userId}', ${trailIds[tIdx]}, ${rating}, '${comment}');\n`;
    }
  }

  // Write the file
  const fs = require('fs');
  const path = require('path');
  const outPath = path.join(__dirname, '..', 'supabase', 'seed.sql');
  fs.writeFileSync(outPath, sql, 'utf-8');
  console.log(`\nSeed SQL written to: ${outPath}`);
  console.log(`  - ${trails.length} trails with route geometry`);
  console.log(`  - ${trails.length * 3} trail media entries`);
  console.log(`  - Checkpoints for each trail`);
  console.log(`  - ${testUsers.length} test users`);
  console.log(`  - Trail completions and reviews`);
}

main().catch(console.error);
