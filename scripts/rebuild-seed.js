/**
 * Rebuild seed.sql with real OSM route coordinates.
 * Reads all_routes.json + existing seed structure and produces updated SQL.
 */

const fs = require('fs');
const path = require('path');

const routesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'all_routes.json'), 'utf8'));
const jutaRoshkaCoords = JSON.parse(fs.readFileSync(path.join(__dirname, 'coords_3817920.json'), 'utf8'));

// Build lookup: trail id -> coordinates
const routeMap = new Map();
for (const r of routesData.found) {
  routeMap.set(r.id, r);
}
// Juta-Roshka already done separately
routeMap.set('a0000000-0000-0000-0000-000000000003', {
  id: 'a0000000-0000-0000-0000-000000000003',
  name: 'Juta to Roshka (Abudelauri Lakes)',
  coordinates: jutaRoshkaCoords.coordinates,
  start: jutaRoshkaCoords.start,
  end: jutaRoshkaCoords.end,
});

// Trail definitions with all metadata
const TRAILS = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    name_en: 'Gergeti Trinity Church', name_ka: 'გერგეტის სამება',
    desc_en: 'Iconic hike to the 14th-century Gergeti Trinity Church perched at 2,170m with stunning views of Mount Kazbek.',
    desc_ka: 'საგზაო ბილიკი გერგეტის სამების ეკლესიამდე.',
    difficulty: 'easy', region: 'Kazbegi', distance_km: 6, elevation_gain_m: 500, estimated_hours: 2.5,
    cover_image_url: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=800',
    checkpoints: [
      { name: 'Stepantsminda Trailhead', type: 'landmark', coordIdx: 0 },
      { name: 'Switchback Viewpoint', type: 'viewpoint', coordIdx: 0.3 },
      { name: 'Gergeti Trinity Church', type: 'church', coordIdx: 0.95 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    name_en: 'Mestia to Ushguli Trek', name_ka: 'მესტიიდან უშგულამდე',
    desc_en: 'Multi-day trek through Upper Svaneti, passing medieval Svan towers and glacier-fed rivers.',
    desc_ka: 'მრავალდღიანი ლაშქრობა ზემო სვანეთში.',
    difficulty: 'hard', region: 'Svaneti', distance_km: 58, elevation_gain_m: 3200, estimated_hours: 28,
    cover_image_url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',
    checkpoints: [
      { name: 'Mestia Town', type: 'landmark', coordIdx: 0 },
      { name: 'Zhabeshi Village', type: 'landmark', coordIdx: 0.2 },
      { name: 'Adishi Village', type: 'landmark', coordIdx: 0.45 },
      { name: 'Iprali Pass', type: 'pass', coordIdx: 0.7 },
      { name: 'Ushguli', type: 'landmark', coordIdx: 0.98 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    name_en: 'Juta to Roshka (Abudelauri Lakes)', name_ka: 'ჯუთადან როშკამდე',
    desc_en: 'High-alpine crossing via colorful Abudelauri Lakes at 3,000m. Crosses Chaukhi Pass at 3,338m.',
    desc_ka: 'მაღალმთიანი გადასასვლელი აბუდელაურის ტბებით.',
    difficulty: 'hard', region: 'Kazbegi', distance_km: 26, elevation_gain_m: 1800, estimated_hours: 10,
    cover_image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
    checkpoints: [
      { name: 'Juta Village Trailhead', type: 'landmark', coordIdx: 0 },
      { name: 'Chaukhi Pass', type: 'pass', coordIdx: 0.45 },
      { name: 'Abudelauri Lakes Area', type: 'lake', coordIdx: 0.75 },
      { name: 'Roshka Village', type: 'landmark', coordIdx: 0.98 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000004',
    name_en: 'Omalo to Dartlo', name_ka: 'ომალოდან დართლომდე',
    desc_en: 'Beautiful day hike through remote Tusheti connecting two medieval fortress villages.',
    desc_ka: 'ლაშქრობა თუშეთის რეგიონში.',
    difficulty: 'medium', region: 'Tusheti', distance_km: 14, elevation_gain_m: 650, estimated_hours: 5,
    cover_image_url: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800',
    checkpoints: [
      { name: 'Omalo Fortress', type: 'landmark', coordIdx: 0 },
      { name: 'Tusheti Valley Viewpoint', type: 'viewpoint', coordIdx: 0.4 },
      { name: 'Dartlo Village', type: 'landmark', coordIdx: 0.95 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000005',
    name_en: 'Truso Valley', name_ka: 'თრუსოს ხეობა',
    desc_en: 'Scenic valley walk along the Terek River past travertine pools and abandoned villages.',
    desc_ka: 'ხეობის გასეირნება თერგის მდინარის გასწვრივ.',
    difficulty: 'easy', region: 'Kazbegi', distance_km: 24, elevation_gain_m: 400, estimated_hours: 6,
    cover_image_url: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800',
    checkpoints: [
      { name: 'Truso Valley Entrance', type: 'landmark', coordIdx: 0 },
      { name: 'Travertine Pools', type: 'water_source', coordIdx: 0.35 },
      { name: 'Abandoned Village Ketrisi', type: 'ruins', coordIdx: 0.65 },
      { name: 'Zakagori Fortress', type: 'ruins', coordIdx: 0.9 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000006',
    name_en: 'Lagodekhi Waterfall Trail', name_ka: 'ლაგოდეხის ჩანჩქერი',
    desc_en: 'Easy nature walk through old-growth forest to a beautiful waterfall in Lagodekhi Protected Areas.',
    desc_ka: 'ბუნების გასეირნება ლაგოდეხში.',
    difficulty: 'easy', region: 'Kakheti', distance_km: 14, elevation_gain_m: 300, estimated_hours: 4,
    cover_image_url: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800',
    checkpoints: [
      { name: 'Lagodekhi Visitor Center', type: 'landmark', coordIdx: 0 },
      { name: 'Forest Bridge', type: 'bridge', coordIdx: 0.4 },
      { name: 'Black Grouse Waterfall', type: 'waterfall', coordIdx: 0.95 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000007',
    name_en: 'Borjomi-Kharagauli: Likani Trail', name_ka: 'ბორჯომ-ხარაგაული: ლიკანი',
    desc_en: 'Day hike in one of Europe\'s largest national parks through mixed forests to alpine meadows.',
    desc_ka: 'ლაშქრობა ეროვნულ პარკში.',
    difficulty: 'medium', region: 'Borjomi-Kharagauli', distance_km: 18, elevation_gain_m: 1100, estimated_hours: 7,
    cover_image_url: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800',
    checkpoints: [
      { name: 'Likani Park Entrance', type: 'landmark', coordIdx: 0 },
      { name: 'Forest Shelter', type: 'shelter', coordIdx: 0.35 },
      { name: 'Alpine Meadow Viewpoint', type: 'viewpoint', coordIdx: 0.7 },
      { name: 'Romanoff Trail Summit', type: 'summit', coordIdx: 0.95 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000008',
    name_en: 'Chaukhi Pass', name_ka: 'ჩაუხის უღელტეხილი',
    desc_en: 'Challenging high-altitude pass crossing at 3,338m with dramatic rock spires.',
    desc_ka: 'მაღალმთიანი უღელტეხილი 3,338 მ-ზე.',
    difficulty: 'ultra', region: 'Kazbegi', distance_km: 16, elevation_gain_m: 1500, estimated_hours: 9,
    cover_image_url: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800',
    checkpoints: [
      { name: 'Juta Approach', type: 'landmark', coordIdx: 0 },
      { name: 'Chaukhi Rock Spires Base', type: 'landmark', coordIdx: 0.5 },
      { name: 'Chaukhi Pass Summit 3338m', type: 'pass', coordIdx: 0.95 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000009',
    name_en: 'Martvili Canyon Trail', name_ka: 'მარტვილის კანიონი',
    desc_en: 'Short but stunning walk along the turquoise Abasha River canyon with cliff walkways.',
    desc_ka: 'აბაშის მდინარის კანიონის გასეირნება.',
    difficulty: 'easy', region: 'Samegrelo', distance_km: 3, elevation_gain_m: 50, estimated_hours: 1,
    cover_image_url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800',
    checkpoints: [
      { name: 'Martvili Canyon Entrance', type: 'landmark', coordIdx: 0 },
      { name: 'Canyon Viewpoint', type: 'viewpoint', coordIdx: 0.5 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000010',
    name_en: 'Okatse Canyon Trail', name_ka: 'ოკაცეს კანიონი',
    desc_en: 'Thrilling walk on a metal walkway suspended over the 100m deep Okatse Canyon.',
    desc_ka: 'ოკაცეს კანიონზე გაკიდებული ლითონის ბილიკი.',
    difficulty: 'easy', region: 'Imereti', distance_km: 7, elevation_gain_m: 200, estimated_hours: 2.5,
    cover_image_url: 'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800',
    checkpoints: [
      { name: 'Okatse Trailhead', type: 'landmark', coordIdx: 0 },
      { name: 'Suspended Walkway', type: 'viewpoint', coordIdx: 0.6 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000011',
    name_en: 'Shatili to Mutso', name_ka: 'შატილიდან მუწომდე',
    desc_en: 'Remote trek in Khevsureti connecting two medieval fortress villages through the Argun Gorge.',
    desc_ka: 'ლაშქრობა ხევსურეთში.',
    difficulty: 'hard', region: 'Khevsureti', distance_km: 12, elevation_gain_m: 800, estimated_hours: 5,
    cover_image_url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800',
    checkpoints: [
      { name: 'Shatili Fortress', type: 'landmark', coordIdx: 0 },
      { name: 'Argun Gorge Viewpoint', type: 'viewpoint', coordIdx: 0.45 },
      { name: 'Mutso Fortress', type: 'ruins', coordIdx: 0.95 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000012',
    name_en: 'Tobavarchkhili (Silver Lake)', name_ka: 'ტობავარჩხილი',
    desc_en: 'Multi-day expedition to the legendary Silver Lake hidden in remote forests west of Kutaisi.',
    desc_ka: 'ექსპედიცია ვერცხლის ტბამდე.',
    difficulty: 'ultra', region: 'Samegrelo', distance_km: 44, elevation_gain_m: 2800, estimated_hours: 24,
    cover_image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    checkpoints: [
      { name: 'Mukhuri Village Start', type: 'landmark', coordIdx: 0 },
      { name: 'Forest Camp', type: 'campsite', coordIdx: 0.3 },
      { name: 'Tobavarchkhili (Silver Lake)', type: 'lake', coordIdx: 0.7 },
      { name: 'Skuri End Point', type: 'landmark', coordIdx: 0.95 },
    ],
  },
];

// Media entries (3 per trail, cycling through relevant images)
const MEDIA_IMAGES = {
  'a0000000-0000-0000-0000-000000000001': [
    'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=600',
    'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
  ],
  'a0000000-0000-0000-0000-000000000002': [
    'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
    'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600',
  ],
  'a0000000-0000-0000-0000-000000000003': [
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
    'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600',
    'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=600',
  ],
  'a0000000-0000-0000-0000-000000000004': [
    'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600',
    'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=600',
    'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=600',
  ],
  'a0000000-0000-0000-0000-000000000005': [
    'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=600',
    'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=600',
    'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600',
  ],
  'a0000000-0000-0000-0000-000000000006': [
    'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=600',
    'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600',
  ],
  'a0000000-0000-0000-0000-000000000007': [
    'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
  ],
  'a0000000-0000-0000-0000-000000000008': [
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
    'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=600',
  ],
  'a0000000-0000-0000-0000-000000000009': [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
    'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=600',
    'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600',
  ],
  'a0000000-0000-0000-0000-000000000010': [
    'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=600',
    'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600',
    'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=600',
  ],
  'a0000000-0000-0000-0000-000000000011': [
    'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600',
    'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=600',
    'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=600',
  ],
  'a0000000-0000-0000-0000-000000000012': [
    'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=600',
    'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=600',
    'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600',
  ],
};

function esc(s) { return s.replace(/'/g, "''"); }

function buildSQL() {
  const lines = [];
  lines.push('-- Georgian Hiking Trails Seed Data');
  lines.push('-- 12 trails with REAL OSM GPS coordinates, media, checkpoints, 4 test users, completions, reviews');
  lines.push('');
  lines.push('TRUNCATE trail_reviews, trail_completions, checkpoint_completions, trail_checkpoints, trail_media, trails CASCADE;');
  lines.push('');

  // === TRAILS ===
  for (const trail of TRAILS) {
    const route = routeMap.get(trail.id);
    if (!route) {
      console.log(`SKIPPING ${trail.name_en} - no route data`);
      continue;
    }

    const coords = route.coordinates;
    const startCoord = coords[0];
    const endCoord = coords[coords.length - 1];

    const pointsSQL = coords.map(([lon, lat]) => `    ST_MakePoint(${lon}, ${lat})`).join(',\n');

    lines.push(`INSERT INTO trails (id, name_en, name_ka, description_en, description_ka, difficulty, region, distance_km, elevation_gain_m, estimated_hours, start_point, end_point, route, cover_image_url, is_published) VALUES (`);
    lines.push(`  '${trail.id}',`);
    lines.push(`  '${esc(trail.name_en)}', '${esc(trail.name_ka)}',`);
    lines.push(`  '${esc(trail.desc_en)}',`);
    lines.push(`  '${esc(trail.desc_ka)}',`);
    lines.push(`  '${trail.difficulty}', '${trail.region}', ${trail.distance_km}, ${trail.elevation_gain_m}, ${trail.estimated_hours},`);
    lines.push(`  ST_SetSRID(ST_MakePoint(${startCoord[0]}, ${startCoord[1]}), 4326),`);
    lines.push(`  ST_SetSRID(ST_MakePoint(${endCoord[0]}, ${endCoord[1]}), 4326),`);
    lines.push(`  ST_SetSRID(ST_MakeLine(ARRAY[`);
    lines.push(pointsSQL);
    lines.push(`  ]), 4326),`);
    lines.push(`  '${trail.cover_image_url}', true`);
    lines.push(`);`);
    lines.push('');
  }

  // === MEDIA ===
  lines.push('-- Trail Media');
  for (const trail of TRAILS) {
    const images = MEDIA_IMAGES[trail.id];
    if (!images) continue;
    images.forEach((url, i) => {
      lines.push(`INSERT INTO trail_media (trail_id, type, url, caption, sort_order) VALUES ('${trail.id}', 'photo', '${url}', '${esc(trail.name_en)} - Photo ${i + 1}', ${i});`);
    });
  }
  lines.push('');

  // === CHECKPOINTS ===
  lines.push('-- Trail Checkpoints (coordinates from real route data)');
  for (const trail of TRAILS) {
    const route = routeMap.get(trail.id);
    if (!route) continue;
    const coords = route.coordinates;

    for (let i = 0; i < trail.checkpoints.length; i++) {
      const cp = trail.checkpoints[i];
      const idx = Math.min(Math.round(cp.coordIdx * (coords.length - 1)), coords.length - 1);
      const [lon, lat] = coords[idx];
      lines.push(`INSERT INTO trail_checkpoints (trail_id, name_en, type, coordinates, sort_order, is_checkable) VALUES ('${trail.id}', '${esc(cp.name)}', '${cp.type}', ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326), ${i}, true);`);
    }
  }
  lines.push('');

  // === TEST USERS ===
  lines.push('-- Test Users');
  lines.push(`INSERT INTO profiles (id, username, full_name, bio, total_trails_completed) VALUES ('b0000000-0000-0000-0000-000000000001', 'mountain_nika', 'Nika Gelashvili', 'Mountain enthusiast from Tbilisi. Conquered 50+ peaks across the Caucasus.', 0) ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username, full_name=EXCLUDED.full_name, bio=EXCLUDED.bio;`);
  lines.push(`INSERT INTO profiles (id, username, full_name, bio, total_trails_completed) VALUES ('b0000000-0000-0000-0000-000000000002', 'hiking_mari', 'Mariam Kvaratskhelia', 'Nature photographer and trail runner. Svaneti is my second home.', 0) ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username, full_name=EXCLUDED.full_name, bio=EXCLUDED.bio;`);
  lines.push(`INSERT INTO profiles (id, username, full_name, bio, total_trails_completed) VALUES ('b0000000-0000-0000-0000-000000000003', 'george_adventures', 'Giorgi Beridze', 'Weekend warrior. Exploring every corner of Georgia one trail at a time.', 0) ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username, full_name=EXCLUDED.full_name, bio=EXCLUDED.bio;`);
  lines.push(`INSERT INTO profiles (id, username, full_name, bio, total_trails_completed) VALUES ('b0000000-0000-0000-0000-000000000004', 'tea_on_trail', 'Teona Mikadze', 'Slow hiker, fast photographer. Always carry tea to the summit.', 0) ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username, full_name=EXCLUDED.full_name, bio=EXCLUDED.bio;`);
  lines.push('');

  // === COMPLETIONS ===
  lines.push('-- Trail Completions');
  const completions = [
    // Nika: 6 trails
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 133],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 19],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 127],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 61],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000008', 36],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000011', 149],
    // Mari: 5 trails
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 2],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 43],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 177],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000006', 96],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000009', 77],
    // Giorgi: 4 trails
    ['b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 146],
    ['b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005', 93],
    ['b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000010', 141],
    ['b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000011', 125],
    // Teona: 3 trails
    ['b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 73],
    ['b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000006', 23],
    ['b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000007', 53],
  ];

  for (const [userId, trailId, daysAgo] of completions) {
    // Get a proof photo coordinate from the trail's end area
    const route = routeMap.get(trailId);
    const endCoord = route ? route.coordinates[route.coordinates.length - 1] : [44.62, 42.66];
    lines.push(`INSERT INTO trail_completions (user_id, trail_id, proof_photo_url, photo_lat, photo_lng, status, completed_at) VALUES ('${userId}', '${trailId}', 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400', ${endCoord[1].toFixed(7)}, ${endCoord[0].toFixed(7)}, 'approved', NOW() - INTERVAL '${daysAgo} days');`);
  }

  lines.push(`UPDATE profiles SET total_trails_completed = 6 WHERE id = 'b0000000-0000-0000-0000-000000000001';`);
  lines.push(`UPDATE profiles SET total_trails_completed = 5 WHERE id = 'b0000000-0000-0000-0000-000000000002';`);
  lines.push(`UPDATE profiles SET total_trails_completed = 4 WHERE id = 'b0000000-0000-0000-0000-000000000003';`);
  lines.push(`UPDATE profiles SET total_trails_completed = 3 WHERE id = 'b0000000-0000-0000-0000-000000000004';`);
  lines.push('');

  // === REVIEWS ===
  lines.push('-- Trail Reviews');
  const reviews = [
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 4, 'Amazing trail! Views are breathtaking.'],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 5, 'Well-maintained path, highly recommend.'],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 4, 'Challenging but rewarding. Bring water.'],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 4, 'Amazing trail! Views are breathtaking.'],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 5, 'Well-maintained path, highly recommend.'],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 4, 'Challenging but rewarding. Bring water.'],
    ['b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 4, 'Amazing trail! Views are breathtaking.'],
    ['b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005', 5, 'Well-maintained path, highly recommend.'],
    ['b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000010', 4, 'Challenging but rewarding. Bring water.'],
    ['b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 4, 'Amazing trail! Views are breathtaking.'],
    ['b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000006', 5, 'Well-maintained path, highly recommend.'],
    ['b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000007', 4, 'Challenging but rewarding. Bring water.'],
  ];

  for (const [userId, trailId, rating, comment] of reviews) {
    lines.push(`INSERT INTO trail_reviews (user_id, trail_id, rating, comment) VALUES ('${userId}', '${trailId}', ${rating}, '${esc(comment)}');`);
  }
  lines.push('');

  return lines.join('\n');
}

const sql = buildSQL();
const outputPath = path.join(__dirname, '..', 'supabase', 'seed.sql');
fs.writeFileSync(outputPath, sql);
console.log(`Wrote ${sql.length} chars to ${outputPath}`);
console.log(`${sql.split('\n').length} lines`);
