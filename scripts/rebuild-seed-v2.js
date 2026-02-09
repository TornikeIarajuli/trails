/**
 * Rebuild seed.sql with ALL trails (12 existing + new from OSM).
 * Reads all_routes.json, coords_3817920.json, new_routes.json.
 */

const fs = require('fs');
const path = require('path');

// Load existing route data
const routesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'all_routes.json'), 'utf8'));
const jutaRoshkaCoords = JSON.parse(fs.readFileSync(path.join(__dirname, 'coords_3817920.json'), 'utf8'));
const newRoutesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'new_routes.json'), 'utf8'));

// Build lookup: trail id -> coordinates
const routeMap = new Map();
for (const r of routesData.found) routeMap.set(r.id, r);
for (const r of newRoutesData.found) routeMap.set(r.id, r);
routeMap.set('a0000000-0000-0000-0000-000000000003', {
  id: 'a0000000-0000-0000-0000-000000000003',
  name: 'Juta to Roshka (Abudelauri Lakes)',
  coordinates: jutaRoshkaCoords.coordinates,
  start: jutaRoshkaCoords.start,
  end: jutaRoshkaCoords.end,
});

// ============ ORIGINAL 12 TRAILS ============
const ORIGINAL_TRAILS = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    name_en: 'Gergeti Trinity Church', name_ka: 'გერგეტის სამება',
    desc_en: 'Iconic hike to the 14th-century Gergeti Trinity Church perched at 2,170m with stunning views of Mount Kazbek.',
    desc_ka: 'საგზაო ბილიკი გერგეტის სამების ეკლესიამდე.',
    difficulty: 'easy', region: 'Kazbegi', distance_km: 6, elevation_gain_m: 500, estimated_hours: 2.5,
    cover: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=800',
    checkpoints: [
      { name: 'Stepantsminda Trailhead', type: 'landmark', idx: 0 },
      { name: 'Switchback Viewpoint', type: 'viewpoint', idx: 0.3 },
      { name: 'Gergeti Trinity Church', type: 'church', idx: 0.95 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    name_en: 'Mestia to Ushguli Trek', name_ka: 'მესტიიდან უშგულამდე',
    desc_en: 'Multi-day trek through Upper Svaneti, passing medieval Svan towers and glacier-fed rivers.',
    desc_ka: 'მრავალდღიანი ლაშქრობა ზემო სვანეთში.',
    difficulty: 'hard', region: 'Svaneti', distance_km: 58, elevation_gain_m: 3200, estimated_hours: 28,
    cover: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',
    checkpoints: [
      { name: 'Mestia Town', type: 'landmark', idx: 0 },
      { name: 'Zhabeshi Village', type: 'landmark', idx: 0.2 },
      { name: 'Adishi Village', type: 'landmark', idx: 0.45 },
      { name: 'Iprali Pass', type: 'pass', idx: 0.7 },
      { name: 'Ushguli', type: 'landmark', idx: 0.98 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    name_en: 'Juta to Roshka (Abudelauri Lakes)', name_ka: 'ჯუთადან როშკამდე',
    desc_en: 'High-alpine crossing via colorful Abudelauri Lakes at 3,000m. Crosses Chaukhi Pass at 3,338m.',
    desc_ka: 'მაღალმთიანი გადასასვლელი აბუდელაურის ტბებით.',
    difficulty: 'hard', region: 'Kazbegi', distance_km: 26, elevation_gain_m: 1800, estimated_hours: 10,
    cover: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
    checkpoints: [
      { name: 'Juta Village Trailhead', type: 'landmark', idx: 0 },
      { name: 'Chaukhi Pass', type: 'pass', idx: 0.45 },
      { name: 'Abudelauri Lakes Area', type: 'lake', idx: 0.75 },
      { name: 'Roshka Village', type: 'landmark', idx: 0.98 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000004',
    name_en: 'Omalo to Dartlo', name_ka: 'ომალოდან დართლომდე',
    desc_en: 'Beautiful day hike through remote Tusheti connecting two medieval fortress villages.',
    desc_ka: 'ლაშქრობა თუშეთის რეგიონში.',
    difficulty: 'medium', region: 'Tusheti', distance_km: 14, elevation_gain_m: 650, estimated_hours: 5,
    cover: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800',
    checkpoints: [
      { name: 'Omalo Fortress', type: 'landmark', idx: 0 },
      { name: 'Tusheti Valley Viewpoint', type: 'viewpoint', idx: 0.4 },
      { name: 'Dartlo Village', type: 'landmark', idx: 0.95 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000005',
    name_en: 'Truso Valley', name_ka: 'თრუსოს ხეობა',
    desc_en: 'Scenic valley walk along the Terek River past travertine pools and abandoned villages.',
    desc_ka: 'ხეობის გასეირნება თერგის მდინარის გასწვრივ.',
    difficulty: 'easy', region: 'Kazbegi', distance_km: 24, elevation_gain_m: 400, estimated_hours: 6,
    cover: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800',
    checkpoints: [
      { name: 'Truso Valley Entrance', type: 'landmark', idx: 0 },
      { name: 'Travertine Pools', type: 'water_source', idx: 0.35 },
      { name: 'Abandoned Village Ketrisi', type: 'ruins', idx: 0.65 },
      { name: 'Zakagori Fortress', type: 'ruins', idx: 0.9 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000006',
    name_en: 'Lagodekhi Waterfall Trail', name_ka: 'ლაგოდეხის ჩანჩქერი',
    desc_en: 'Easy nature walk through old-growth forest to a beautiful waterfall in Lagodekhi Protected Areas.',
    desc_ka: 'ბუნების გასეირნება ლაგოდეხში.',
    difficulty: 'easy', region: 'Kakheti', distance_km: 14, elevation_gain_m: 300, estimated_hours: 4,
    cover: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800',
    checkpoints: [
      { name: 'Lagodekhi Visitor Center', type: 'landmark', idx: 0 },
      { name: 'Forest Bridge', type: 'bridge', idx: 0.4 },
      { name: 'Black Grouse Waterfall', type: 'waterfall', idx: 0.95 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000007',
    name_en: 'Borjomi-Kharagauli: Likani Trail', name_ka: 'ბორჯომ-ხარაგაული: ლიკანი',
    desc_en: 'Day hike in one of Europe\'s largest national parks through mixed forests to alpine meadows.',
    desc_ka: 'ლაშქრობა ეროვნულ პარკში.',
    difficulty: 'medium', region: 'Borjomi-Kharagauli', distance_km: 18, elevation_gain_m: 1100, estimated_hours: 7,
    cover: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800',
    checkpoints: [
      { name: 'Likani Park Entrance', type: 'landmark', idx: 0 },
      { name: 'Forest Shelter', type: 'shelter', idx: 0.35 },
      { name: 'Alpine Meadow Viewpoint', type: 'viewpoint', idx: 0.7 },
      { name: 'Romanoff Trail Summit', type: 'summit', idx: 0.95 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000008',
    name_en: 'Chaukhi Pass', name_ka: 'ჩაუხის უღელტეხილი',
    desc_en: 'Challenging high-altitude pass crossing at 3,338m with dramatic rock spires.',
    desc_ka: 'მაღალმთიანი უღელტეხილი 3,338 მ-ზე.',
    difficulty: 'ultra', region: 'Kazbegi', distance_km: 16, elevation_gain_m: 1500, estimated_hours: 9,
    cover: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800',
    checkpoints: [
      { name: 'Juta Approach', type: 'landmark', idx: 0 },
      { name: 'Chaukhi Rock Spires Base', type: 'landmark', idx: 0.5 },
      { name: 'Chaukhi Pass Summit 3338m', type: 'pass', idx: 0.95 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000009',
    name_en: 'Martvili Canyon Trail', name_ka: 'მარტვილის კანიონი',
    desc_en: 'Short but stunning walk along the turquoise Abasha River canyon with cliff walkways.',
    desc_ka: 'აბაშის მდინარის კანიონის გასეირნება.',
    difficulty: 'easy', region: 'Samegrelo', distance_km: 3, elevation_gain_m: 50, estimated_hours: 1,
    cover: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800',
    checkpoints: [
      { name: 'Martvili Canyon Entrance', type: 'landmark', idx: 0 },
      { name: 'Canyon Viewpoint', type: 'viewpoint', idx: 0.5 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000010',
    name_en: 'Okatse Canyon Trail', name_ka: 'ოკაცეს კანიონი',
    desc_en: 'Thrilling walk on a metal walkway suspended over the 100m deep Okatse Canyon.',
    desc_ka: 'ოკაცეს კანიონზე გაკიდებული ლითონის ბილიკი.',
    difficulty: 'easy', region: 'Imereti', distance_km: 7, elevation_gain_m: 200, estimated_hours: 2.5,
    cover: 'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800',
    checkpoints: [
      { name: 'Okatse Trailhead', type: 'landmark', idx: 0 },
      { name: 'Suspended Walkway', type: 'viewpoint', idx: 0.6 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000011',
    name_en: 'Shatili to Mutso', name_ka: 'შატილიდან მუწომდე',
    desc_en: 'Remote trek in Khevsureti connecting two medieval fortress villages through the Argun Gorge.',
    desc_ka: 'ლაშქრობა ხევსურეთში.',
    difficulty: 'hard', region: 'Khevsureti', distance_km: 12, elevation_gain_m: 800, estimated_hours: 5,
    cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800',
    checkpoints: [
      { name: 'Shatili Fortress', type: 'landmark', idx: 0 },
      { name: 'Argun Gorge Viewpoint', type: 'viewpoint', idx: 0.45 },
      { name: 'Mutso Fortress', type: 'ruins', idx: 0.95 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000012',
    name_en: 'Tobavarchkhili (Silver Lake)', name_ka: 'ტობავარჩხილი',
    desc_en: 'Multi-day expedition to the legendary Silver Lake hidden in remote forests west of Kutaisi.',
    desc_ka: 'ექსპედიცია ვერცხლის ტბამდე.',
    difficulty: 'ultra', region: 'Samegrelo', distance_km: 44, elevation_gain_m: 2800, estimated_hours: 24,
    cover: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    checkpoints: [
      { name: 'Mukhuri Village Start', type: 'landmark', idx: 0 },
      { name: 'Forest Camp', type: 'campsite', idx: 0.3 },
      { name: 'Tobavarchkhili (Silver Lake)', type: 'lake', idx: 0.7 },
      { name: 'Skuri End Point', type: 'landmark', idx: 0.95 },
    ],
  },
];

// ============ NEW TRAILS ============
const NEW_TRAILS = [
  // SVANETI
  { id: 'a0000000-0000-0000-0000-000000000013', name_en: 'Koruldi Lakes', name_ka: 'კორულდის ტბები', desc_en: 'Alpine meadow hike to the stunning Koruldi Lakes at 2,740m with panoramic views of Ushba and Tetnuldi.', desc_ka: 'ალპური მდელოების ლაშქრობა კორულდის ტბებამდე.', difficulty: 'medium', region: 'Svaneti', distance_km: 12, elevation_gain_m: 1200, estimated_hours: 5, cover: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', checkpoints: [{ name: 'Mestia Start', type: 'landmark', idx: 0 }, { name: 'Koruldi Lakes', type: 'lake', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000014', name_en: 'Mestia to Chalaadi Glacier', name_ka: 'მესტიიდან ჩალაადის მყინვარამდე', desc_en: 'Easy forest walk from Mestia to the tongue of Chalaadi Glacier, crossing a dramatic suspension bridge.', desc_ka: 'ტყის გასეირნება ჩალაადის მყინვარამდე.', difficulty: 'easy', region: 'Svaneti', distance_km: 8, elevation_gain_m: 300, estimated_hours: 3, cover: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', checkpoints: [{ name: 'Mestia Bridge', type: 'bridge', idx: 0 }, { name: 'Chalaadi Glacier', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000015', name_en: 'Mazeri to Ushba Glacier', name_ka: 'მაზერიდან უშბის მყინვარამდე', desc_en: 'Dramatic approach to the base of Mount Ushba through pristine Svaneti valleys.', desc_ka: 'უშბის მთის ძირამდე მისვლა მაზერიდან.', difficulty: 'medium', region: 'Svaneti', distance_km: 14, elevation_gain_m: 800, estimated_hours: 6, cover: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', checkpoints: [{ name: 'Mazeri Village', type: 'landmark', idx: 0 }, { name: 'Ushba Glacier Viewpoint', type: 'viewpoint', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000016', name_en: 'Mestia - Guli Pass - Mazeri', name_ka: 'მესტია - გულის უღელტეხილი - მაზერი', desc_en: 'High alpine pass crossing connecting Mestia to Mazeri through stunning glacier country.', desc_ka: 'მაღალმთიანი გადასასვლელი მესტიიდან მაზერისკენ.', difficulty: 'hard', region: 'Svaneti', distance_km: 20, elevation_gain_m: 1500, estimated_hours: 9, cover: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800', checkpoints: [{ name: 'Mestia', type: 'landmark', idx: 0 }, { name: 'Guli Pass', type: 'pass', idx: 0.5 }, { name: 'Mazeri Village', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000017', name_en: 'Ushguli to Chvelpi', name_ka: 'უშგულიდან ჩველპიმდე', desc_en: 'Short walk from the UNESCO-listed Ushguli village to the remote hamlet of Chvelpi.', desc_ka: 'გასეირნება უშგულიდან ჩველპიმდე.', difficulty: 'easy', region: 'Svaneti', distance_km: 6, elevation_gain_m: 200, estimated_hours: 2, cover: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', checkpoints: [{ name: 'Ushguli', type: 'landmark', idx: 0 }, { name: 'Chvelpi', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000018', name_en: 'Ushguli to Shkhara Glacier', name_ka: 'უშგულიდან შხარის მყინვარამდე', desc_en: 'Hike from Europe\'s highest continuously inhabited village to the base of Georgia\'s tallest mountain.', desc_ka: 'უშგულიდან შხარის მყინვარამდე ლაშქრობა.', difficulty: 'medium', region: 'Svaneti', distance_km: 16, elevation_gain_m: 700, estimated_hours: 6, cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', checkpoints: [{ name: 'Ushguli', type: 'landmark', idx: 0 }, { name: 'Shkhara Glacier', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000019', name_en: 'Laila Glacier Trail', name_ka: 'ლაილას მყინვარი', desc_en: 'Remote glacier approach in the Svaneti highlands to Mount Laila.', desc_ka: 'ლაილას მყინვარამდე მისვლა სვანეთში.', difficulty: 'hard', region: 'Svaneti', distance_km: 18, elevation_gain_m: 1300, estimated_hours: 8, cover: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800', checkpoints: [{ name: 'Trailhead', type: 'landmark', idx: 0 }, { name: 'Laila Glacier', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000020', name_en: 'Zhabeshi to Tviberi Glacier', name_ka: 'ჟაბეშიდან ტვიბერის მყინვარამდე', desc_en: 'Valley trek from Zhabeshi village to the impressive Tviberi Glacier in Upper Svaneti.', desc_ka: 'ლაშქრობა ჟაბეშიდან ტვიბერის მყინვარამდე.', difficulty: 'medium', region: 'Svaneti', distance_km: 12, elevation_gain_m: 600, estimated_hours: 5, cover: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800', checkpoints: [{ name: 'Zhabeshi Village', type: 'landmark', idx: 0 }, { name: 'Tviberi Glacier', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000021', name_en: 'Mazeri - Meziri Lake - Etseri', name_ka: 'მაზერი - მეზირის ტბა - ეწერი', desc_en: 'Traverse from Mazeri to Etseri via the scenic Meziri Lake at high altitude.', desc_ka: 'გადასვლა მაზერიდან ეწერში მეზირის ტბით.', difficulty: 'hard', region: 'Svaneti', distance_km: 15, elevation_gain_m: 1100, estimated_hours: 7, cover: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800', checkpoints: [{ name: 'Mazeri', type: 'landmark', idx: 0 }, { name: 'Meziri Lake', type: 'lake', idx: 0.5 }, { name: 'Etseri', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000022', name_en: 'Mestia - Hatsvali - Zuruldi', name_ka: 'მესტია - ხაცვალი - ზურულდი', desc_en: 'Scenic ridge walk from Mestia via Hatsvali ski area to the Zuruldi viewpoint.', desc_ka: 'ქედზე სიარული მესტიიდან ზურულდიმდე.', difficulty: 'medium', region: 'Svaneti', distance_km: 10, elevation_gain_m: 900, estimated_hours: 4, cover: 'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800', checkpoints: [{ name: 'Mestia', type: 'landmark', idx: 0 }, { name: 'Hatsvali', type: 'landmark', idx: 0.5 }, { name: 'Zuruldi', type: 'viewpoint', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000023', name_en: 'Mount Laila Traverse', name_ka: 'ლაილას მთის გადაკვეთა', desc_en: 'Epic multi-day traverse around Mount Laila connecting Tviberi and Mananauri villages.', desc_ka: 'ლაილას მთის მრავალდღიანი გადაკვეთა.', difficulty: 'ultra', region: 'Svaneti', distance_km: 30, elevation_gain_m: 2200, estimated_hours: 16, cover: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=800', checkpoints: [{ name: 'Tviberi Village', type: 'landmark', idx: 0 }, { name: 'Laila Base', type: 'campsite', idx: 0.5 }, { name: 'Mananauri', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000024', name_en: 'Khaishi to Lakumura Lake', name_ka: 'ხაიშიდან ლაკუმურას ტბამდე', desc_en: 'Remote lake hike from Khaishi to the hidden Lakumura Lake in Lower Svaneti.', desc_ka: 'ლაშქრობა ხაიშიდან ლაკუმურას ტბამდე.', difficulty: 'hard', region: 'Svaneti', distance_km: 22, elevation_gain_m: 1400, estimated_hours: 10, cover: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800', checkpoints: [{ name: 'Khaishi', type: 'landmark', idx: 0 }, { name: 'Lakumura Lake', type: 'lake', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000025', name_en: 'Okrostskali Lakes', name_ka: 'ოქროსწყალის ტბები', desc_en: 'Hike to the Big and Small Okrostskali Lakes in the Svaneti highlands.', desc_ka: 'ოქროსწყალის ტბებამდე ლაშქრობა.', difficulty: 'medium', region: 'Svaneti', distance_km: 14, elevation_gain_m: 900, estimated_hours: 6, cover: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', checkpoints: [{ name: 'Trailhead', type: 'landmark', idx: 0 }, { name: 'Small Lake', type: 'lake', idx: 0.6 }, { name: 'Big Lake', type: 'lake', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000026', name_en: 'Lake Memuli', name_ka: 'მემულის ტბა', desc_en: 'Alpine lake hike in Upper Svaneti to the beautiful Lake Memuli.', desc_ka: 'მემულის ტბამდე ლაშქრობა.', difficulty: 'medium', region: 'Svaneti', distance_km: 10, elevation_gain_m: 800, estimated_hours: 5, cover: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'Lake Memuli', type: 'lake', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000027', name_en: 'Latali to Mheer Church', name_ka: 'ლატალიდან მხეერის ეკლესიამდე', desc_en: 'Cultural hike from Latali to the medieval Church of the Archangel Gabriel in Mheer.', desc_ka: 'კულტურული ლაშქრობა მხეერის ეკლესიამდე.', difficulty: 'easy', region: 'Svaneti', distance_km: 8, elevation_gain_m: 400, estimated_hours: 3, cover: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', checkpoints: [{ name: 'Latali', type: 'landmark', idx: 0 }, { name: 'Mheer Church', type: 'church', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000028', name_en: 'Chvabiani to Adishi', name_ka: 'ჩვაბიანიდან ადიშამდე', desc_en: 'Scenic village-to-village hike through classic Svaneti landscapes to remote Adishi.', desc_ka: 'სოფლიდან სოფლამდე ლაშქრობა ადიშისკენ.', difficulty: 'medium', region: 'Svaneti', distance_km: 14, elevation_gain_m: 700, estimated_hours: 5, cover: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800', checkpoints: [{ name: 'Chvabiani', type: 'landmark', idx: 0 }, { name: 'Adishi', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000029', name_en: 'Kala to Latpari Pass', name_ka: 'კალადან ლატფარის უღელტეხილამდე', desc_en: 'High pass crossing from Kala to the Latpari Pass with sweeping mountain views.', desc_ka: 'უღელტეხილის გადაკვეთა ლატფარის უღელტეხილამდე.', difficulty: 'hard', region: 'Svaneti', distance_km: 16, elevation_gain_m: 1200, estimated_hours: 7, cover: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800', checkpoints: [{ name: 'Kala', type: 'landmark', idx: 0 }, { name: 'Latpari Pass', type: 'pass', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000030', name_en: 'Mestia Cross Trail', name_ka: 'მესტიის ჯვრის ბილიკი', desc_en: 'Short loop hike above Mestia to the Cross viewpoint with panoramic mountain views.', desc_ka: 'მესტიის ჯვრის ბილიკი პანორამული ხედებით.', difficulty: 'easy', region: 'Svaneti', distance_km: 5, elevation_gain_m: 350, estimated_hours: 2, cover: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800', checkpoints: [{ name: 'Mestia Center', type: 'landmark', idx: 0 }, { name: 'Cross Viewpoint', type: 'viewpoint', idx: 0.5 }] },
  { id: 'a0000000-0000-0000-0000-000000000031', name_en: 'Etseri to Bak Pass', name_ka: 'ეწერიდან ბაქის უღელტეხილამდე', desc_en: 'Mountain pass hike from Etseri village to the scenic Bak Pass.', desc_ka: 'ეწერიდან ბაქის უღელტეხილამდე ლაშქრობა.', difficulty: 'hard', region: 'Svaneti', distance_km: 12, elevation_gain_m: 1000, estimated_hours: 6, cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', checkpoints: [{ name: 'Etseri', type: 'landmark', idx: 0 }, { name: 'Bak Pass', type: 'pass', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000032', name_en: 'Leiraki Waterfall Trail', name_ka: 'ლეირაკის ჩანჩქერის ბილიკი', desc_en: 'Valley hike to the beautiful Leiraki Waterfall and Tavrani valley.', desc_ka: 'ლეირაკის ჩანჩქერამდე ლაშქრობა.', difficulty: 'medium', region: 'Svaneti', distance_km: 10, elevation_gain_m: 500, estimated_hours: 4, cover: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'Leiraki Waterfall', type: 'waterfall', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000033', name_en: 'Shuano Mountain Trail', name_ka: 'შუანოს მთის ბილიკი', desc_en: 'Summit hike to Shuano Mountain in the Svaneti highlands.', desc_ka: 'შუანოს მთის მწვერვალზე ასვლა.', difficulty: 'hard', region: 'Svaneti', distance_km: 14, elevation_gain_m: 1100, estimated_hours: 7, cover: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=800', checkpoints: [{ name: 'Trailhead', type: 'landmark', idx: 0 }, { name: 'Shuano Summit', type: 'summit', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000034', name_en: 'Gvirgvina Mountain Trail', name_ka: 'გვირგვინას მთის ბილიკი', desc_en: 'Remote summit hike to Gvirgvina Mountain in Svaneti.', desc_ka: 'გვირგვინას მთის ბილიკი სვანეთში.', difficulty: 'hard', region: 'Svaneti', distance_km: 16, elevation_gain_m: 1300, estimated_hours: 8, cover: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', checkpoints: [{ name: 'Trailhead', type: 'landmark', idx: 0 }, { name: 'Gvirgvina Summit', type: 'summit', idx: 0.95 }] },

  // TUSHETI
  { id: 'a0000000-0000-0000-0000-000000000035', name_en: 'Atsunta Pass', name_ka: 'აწუნთას უღელტეხილი', desc_en: 'Epic multi-day pass crossing from Tusheti to Khevsureti via the 3,431m Atsunta Pass.', desc_ka: 'მრავალდღიანი ლაშქრობა აწუნთას უღელტეხილით.', difficulty: 'ultra', region: 'Tusheti', distance_km: 55, elevation_gain_m: 3000, estimated_hours: 28, cover: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', checkpoints: [{ name: 'Omalo', type: 'landmark', idx: 0 }, { name: 'Atsunta Pass 3431m', type: 'pass', idx: 0.5 }, { name: 'Shatili', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000036', name_en: 'Omalo to Diklo', name_ka: 'ომალოდან დიკლომდე', desc_en: 'Day hike from Omalo to the remote border village of Diklo with stunning valley views.', desc_ka: 'ლაშქრობა ომალოდან დიკლომდე.', difficulty: 'medium', region: 'Tusheti', distance_km: 18, elevation_gain_m: 800, estimated_hours: 7, cover: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', checkpoints: [{ name: 'Omalo', type: 'landmark', idx: 0 }, { name: 'Diklo Village', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000037', name_en: 'Omalo Round Trail', name_ka: 'ომალოს წრიული ბილიკი', desc_en: 'Multi-day circular trek from Omalo through Bochorma, Dochu, and Khakhabo villages.', desc_ka: 'ომალოს წრიული ბილიკი სოფლების გავლით.', difficulty: 'hard', region: 'Tusheti', distance_km: 35, elevation_gain_m: 2000, estimated_hours: 16, cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', checkpoints: [{ name: 'Omalo', type: 'landmark', idx: 0 }, { name: 'Bochorma', type: 'landmark', idx: 0.3 }, { name: 'Dochu', type: 'landmark', idx: 0.6 }, { name: 'Khakhabo', type: 'landmark', idx: 0.8 }] },
  { id: 'a0000000-0000-0000-0000-000000000038', name_en: 'Diklo to Dartlo Red Trail', name_ka: 'დიკლოდან დართლომდე', desc_en: 'Red-marked trail from Diklo through Chigho to Dartlo via the scenic Tusheti ridges.', desc_ka: 'წითელი ბილიკი დიკლოდან დართლომდე.', difficulty: 'hard', region: 'Tusheti', distance_km: 25, elevation_gain_m: 1500, estimated_hours: 10, cover: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800', checkpoints: [{ name: 'Diklo', type: 'landmark', idx: 0 }, { name: 'Chigho', type: 'landmark', idx: 0.5 }, { name: 'Dartlo', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000039', name_en: 'Omalo to Nakle Kholi Pass', name_ka: 'ომალოდან ნაკლე ხოლის უღელტეხილამდე', desc_en: 'High pass hike from Omalo to the Nakle Kholi Pass with breathtaking Caucasus panoramas.', desc_ka: 'ომალოდან ნაკლე ხოლის უღელტეხილამდე.', difficulty: 'hard', region: 'Tusheti', distance_km: 20, elevation_gain_m: 1400, estimated_hours: 9, cover: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800', checkpoints: [{ name: 'Omalo', type: 'landmark', idx: 0 }, { name: 'Nakle Kholi Pass', type: 'pass', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000040', name_en: 'Oreti Lake Hike', name_ka: 'ორეთის ტბის ლაშქრობა', desc_en: 'Beautiful alpine lake hike to the secluded Oreti Lake in Tusheti.', desc_ka: 'ორეთის ტბამდე ლაშქრობა თუშეთში.', difficulty: 'hard', region: 'Tusheti', distance_km: 14, elevation_gain_m: 1000, estimated_hours: 6, cover: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'Oreti Lake', type: 'lake', idx: 0.95 }] },

  // KAZBEGI
  { id: 'a0000000-0000-0000-0000-000000000041', name_en: 'Juta Waterfall and Lake', name_ka: 'ჯუთას ჩანჩქერი და ტბა', desc_en: 'Easy day hike from Juta village to a scenic waterfall and alpine lake.', desc_ka: 'ჯუთას ჩანჩქერამდე და ტბამდე ლაშქრობა.', difficulty: 'easy', region: 'Kazbegi', distance_km: 10, elevation_gain_m: 400, estimated_hours: 3.5, cover: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', checkpoints: [{ name: 'Juta Village', type: 'landmark', idx: 0 }, { name: 'Waterfall', type: 'waterfall', idx: 0.5 }, { name: 'Alpine Lake', type: 'lake', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000042', name_en: 'Arsha to Stepantsminda', name_ka: 'არშიდან სტეფანწმინდამდე', desc_en: 'Scenic trail from Arsha village to Stepantsminda along the Terek River valley.', desc_ka: 'არშიდან სტეფანწმინდამდე ბილიკი.', difficulty: 'easy', region: 'Kazbegi', distance_km: 8, elevation_gain_m: 250, estimated_hours: 2.5, cover: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=800', checkpoints: [{ name: 'Arsha', type: 'landmark', idx: 0 }, { name: 'Stepantsminda', type: 'landmark', idx: 0.95 }] },

  // KAKHETI
  { id: 'a0000000-0000-0000-0000-000000000043', name_en: 'Lagodekhi Black Rock Lake', name_ka: 'ლაგოდეხი შავი კლდის ტბა', desc_en: 'Challenging overnight hike to the remote Black Rock Lake through ancient forest in Lagodekhi.', desc_ka: 'ლაგოდეხის შავი კლდის ტბამდე ლაშქრობა.', difficulty: 'hard', region: 'Kakheti', distance_km: 24, elevation_gain_m: 1600, estimated_hours: 12, cover: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800', checkpoints: [{ name: 'Lagodekhi Visitor Center', type: 'landmark', idx: 0 }, { name: 'Black Rock Lake', type: 'lake', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000044', name_en: 'Lagodekhi Yew Tree and Tbikeli Lake', name_ka: 'ლაგოდეხი უძველესი წიფელი', desc_en: 'Nature trail to an ancient yew tree and the serene Lake Tbikeli in Lagodekhi Protected Areas.', desc_ka: 'უძველესი წიფელისა და თბიკელის ტბის ბილიკი.', difficulty: 'medium', region: 'Kakheti', distance_km: 16, elevation_gain_m: 800, estimated_hours: 7, cover: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800', checkpoints: [{ name: 'Visitor Center', type: 'landmark', idx: 0 }, { name: 'Ancient Yew Tree', type: 'landmark', idx: 0.5 }, { name: 'Lake Tbikeli', type: 'lake', idx: 0.95 }] },

  // BORJOMI-KHARAGAULI
  { id: 'a0000000-0000-0000-0000-000000000045', name_en: 'Borjomi Panorama Trail', name_ka: 'ბორჯომის პანორამის ბილიკი', desc_en: 'Long-distance trail through Borjomi-Kharagauli National Park with stunning panoramic views. 34km.', desc_ka: 'გრძელი ბილიკი ბორჯომ-ხარაგაულის ეროვნულ პარკში.', difficulty: 'hard', region: 'Borjomi-Kharagauli', distance_km: 34, elevation_gain_m: 2000, estimated_hours: 14, cover: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800', checkpoints: [{ name: 'Park Entrance', type: 'landmark', idx: 0 }, { name: 'Panorama Point', type: 'viewpoint', idx: 0.5 }, { name: 'End', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000046', name_en: 'St. Andrews Trail', name_ka: 'წმინდა ანდრიას ბილიკი', desc_en: 'Pilgrim trail through the forests of Borjomi-Kharagauli National Park.', desc_ka: 'მომლოცველთა ბილიკი ბორჯომ-ხარაგაულის პარკში.', difficulty: 'medium', region: 'Borjomi-Kharagauli', distance_km: 20, elevation_gain_m: 1000, estimated_hours: 8, cover: 'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'St. Andrews Shelter', type: 'shelter', idx: 0.5 }, { name: 'End', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000047', name_en: 'Shepherds Trail', name_ka: 'მწყემსების ბილიკი', desc_en: 'Traditional shepherds path through alpine pastures in Borjomi-Kharagauli.', desc_ka: 'მწყემსების ტრადიციული ბილიკი.', difficulty: 'medium', region: 'Borjomi-Kharagauli', distance_km: 16, elevation_gain_m: 900, estimated_hours: 7, cover: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'Shepherd Shelter', type: 'shelter', idx: 0.5 }] },
  { id: 'a0000000-0000-0000-0000-000000000048', name_en: 'Pure Pristine Forest Trail', name_ka: 'ხელუხლებელი ტყის ბილიკი', desc_en: 'Nature trail through pristine old-growth forest in Borjomi-Kharagauli.', desc_ka: 'ხელუხლებელი ტყის ბილიკი.', difficulty: 'easy', region: 'Borjomi-Kharagauli', distance_km: 10, elevation_gain_m: 400, estimated_hours: 4, cover: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800', checkpoints: [{ name: 'Forest Entrance', type: 'landmark', idx: 0 }, { name: 'Old Growth Forest', type: 'landmark', idx: 0.5 }] },
  { id: 'a0000000-0000-0000-0000-000000000049', name_en: 'Following Wildlife Traces', name_ka: 'ველური ბუნების კვალზე', desc_en: 'Wildlife observation trail through diverse habitats in Borjomi-Kharagauli National Park.', desc_ka: 'ველური ბუნების დაკვირვების ბილიკი.', difficulty: 'easy', region: 'Borjomi-Kharagauli', distance_km: 8, elevation_gain_m: 300, estimated_hours: 3, cover: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800', checkpoints: [{ name: 'Park Gate', type: 'landmark', idx: 0 }, { name: 'Wildlife Area', type: 'viewpoint', idx: 0.5 }] },
  { id: 'a0000000-0000-0000-0000-000000000050', name_en: 'Sairme Pass Trail', name_ka: 'საირმეს უღელტეხილის ბილიკი', desc_en: 'Mountain pass trail near the Sairme resort area in the Borjomi region.', desc_ka: 'საირმეს უღელტეხილის ბილიკი.', difficulty: 'medium', region: 'Borjomi-Kharagauli', distance_km: 14, elevation_gain_m: 800, estimated_hours: 6, cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'Sairme Pass', type: 'pass', idx: 0.95 }] },

  // TBILISI AREA
  { id: 'a0000000-0000-0000-0000-000000000051', name_en: 'Mtatsminda to Narikala Fortress', name_ka: 'მთაწმინდიდან ნარიყალას ციხემდე', desc_en: 'Urban ridge walk from Mtatsminda Park to the ancient Narikala Fortress with city views.', desc_ka: 'ქალაქური ლაშქრობა მთაწმინდიდან ნარიყალამდე.', difficulty: 'easy', region: 'Tbilisi', distance_km: 5, elevation_gain_m: 200, estimated_hours: 2, cover: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=800', checkpoints: [{ name: 'Mtatsminda Park', type: 'landmark', idx: 0 }, { name: 'Narikala Fortress', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000052', name_en: 'Tbilisi National Park Trail', name_ka: 'თბილისის ეროვნული პარკის ბილიკი', desc_en: 'Forest trail in the Tbilisi National Park, perfect for a half-day nature escape from the city.', desc_ka: 'ტყის ბილიკი თბილისის ეროვნულ პარკში.', difficulty: 'medium', region: 'Tbilisi', distance_km: 12, elevation_gain_m: 600, estimated_hours: 5, cover: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800', checkpoints: [{ name: 'Park Entrance', type: 'landmark', idx: 0 }, { name: 'Forest Viewpoint', type: 'viewpoint', idx: 0.5 }] },
  { id: 'a0000000-0000-0000-0000-000000000053', name_en: 'Mtatsminda to Kojori', name_ka: 'მთაწმინდიდან კოჯორამდე', desc_en: 'Long ridge trail from Mtatsminda to the town of Kojori through forested hills.', desc_ka: 'ქედის ბილიკი მთაწმინდიდან კოჯორამდე.', difficulty: 'medium', region: 'Tbilisi', distance_km: 16, elevation_gain_m: 700, estimated_hours: 6, cover: 'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800', checkpoints: [{ name: 'Mtatsminda', type: 'landmark', idx: 0 }, { name: 'Kojori', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000054', name_en: 'Betania to Kveseti', name_ka: 'ბეთანიიდან კვესეთამდე', desc_en: 'Countryside walk from the historic Betania Monastery through rural landscapes.', desc_ka: 'ბეთანიის მონასტრიდან კვესეთამდე გასეირნება.', difficulty: 'easy', region: 'Tbilisi', distance_km: 8, elevation_gain_m: 300, estimated_hours: 3, cover: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', checkpoints: [{ name: 'Betania Monastery', type: 'church', idx: 0 }, { name: 'Kveseti', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000055', name_en: 'Kiketi to Kabeni Monastery', name_ka: 'კიკეთიდან ქაბენის მონასტრამდე', desc_en: 'Forest walk from Kiketi to the secluded Kabeni Monastery near Tbilisi.', desc_ka: 'ტყის გასეირნება ქაბენის მონასტრამდე.', difficulty: 'easy', region: 'Tbilisi', distance_km: 6, elevation_gain_m: 250, estimated_hours: 2.5, cover: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800', checkpoints: [{ name: 'Kiketi', type: 'landmark', idx: 0 }, { name: 'Kabeni Monastery', type: 'church', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000056', name_en: 'Kojori to Kabeni Waterfalls', name_ka: 'კოჯორიდან ქაბენის ჩანჩქერებამდე', desc_en: 'Day hike from Kojori to the Kabeni Monastery and nearby waterfalls.', desc_ka: 'კოჯორიდან ქაბენის ჩანჩქერებამდე ლაშქრობა.', difficulty: 'medium', region: 'Tbilisi', distance_km: 10, elevation_gain_m: 500, estimated_hours: 4, cover: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800', checkpoints: [{ name: 'Kojori', type: 'landmark', idx: 0 }, { name: 'Kabeni Waterfalls', type: 'waterfall', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000057', name_en: 'Kojori to Asureti', name_ka: 'კოჯორიდან ასურეთამდე', desc_en: 'Long distance trail from Kojori to the German-founded village of Asureti.', desc_ka: 'კოჯორიდან ასურეთამდე ლაშქრობა.', difficulty: 'medium', region: 'Tbilisi', distance_km: 18, elevation_gain_m: 600, estimated_hours: 7, cover: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800', checkpoints: [{ name: 'Kojori', type: 'landmark', idx: 0 }, { name: 'Asureti', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000058', name_en: 'Akhaldaba to Betania Monastery', name_ka: 'ახალდაბიდან ბეთანიის მონასტრამდე', desc_en: 'Pilgrimage trail from Akhaldaba to the 12th-century Betania Monastery.', desc_ka: 'ახალდაბიდან ბეთანიის მონასტრამდე.', difficulty: 'easy', region: 'Tbilisi', distance_km: 6, elevation_gain_m: 300, estimated_hours: 2.5, cover: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', checkpoints: [{ name: 'Akhaldaba', type: 'landmark', idx: 0 }, { name: 'Betania Monastery', type: 'church', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000059', name_en: 'Armazi Fortress Trail', name_ka: 'არმაზის ციხის ბილიკი', desc_en: 'Historic trail to the ruins of ancient Armazi Fortress near Mtskheta.', desc_ka: 'ბილიკი ძველი არმაზის ციხესიმაგრემდე.', difficulty: 'easy', region: 'Tbilisi', distance_km: 5, elevation_gain_m: 200, estimated_hours: 2, cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', checkpoints: [{ name: 'Armazi Village', type: 'landmark', idx: 0 }, { name: 'Armazi Fortress', type: 'ruins', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000060', name_en: 'Didgori to Chili Lake', name_ka: 'დიდგორიდან ჩილი ტბამდე', desc_en: 'Hike from the historic Didgori battlefield to Chili Lake through rolling hills.', desc_ka: 'დიდგორიდან ჩილი ტბამდე ლაშქრობა.', difficulty: 'medium', region: 'Tbilisi', distance_km: 14, elevation_gain_m: 700, estimated_hours: 5, cover: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', checkpoints: [{ name: 'Didgori Memorial', type: 'landmark', idx: 0 }, { name: 'Chili Lake', type: 'lake', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000061', name_en: 'Khmala Mountain Trail', name_ka: 'ხმალას მთის ბილიკი', desc_en: 'Ridge trail from Lower Sharakhevi over Khmala Mountain to Bodakhevi.', desc_ka: 'ქედის ბილიკი ხმალას მთაზე.', difficulty: 'medium', region: 'Tbilisi', distance_km: 12, elevation_gain_m: 600, estimated_hours: 5, cover: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800', checkpoints: [{ name: 'Sharakhevi', type: 'landmark', idx: 0 }, { name: 'Khmala Mountain', type: 'summit', idx: 0.5 }, { name: 'Bodakhevi', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000062', name_en: 'Tana Gorge Round Trail', name_ka: 'თანას ხეობის წრიული ბილიკი', desc_en: 'Scenic loop hike through the picturesque Tana Gorge near Tbilisi.', desc_ka: 'წრიული ბილიკი თანას ხეობაში.', difficulty: 'easy', region: 'Tbilisi', distance_km: 8, elevation_gain_m: 350, estimated_hours: 3, cover: 'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800', checkpoints: [{ name: 'Gorge Entrance', type: 'landmark', idx: 0 }, { name: 'Tana Viewpoint', type: 'viewpoint', idx: 0.5 }] },

  // ADJARA
  { id: 'a0000000-0000-0000-0000-000000000063', name_en: 'Gonio Cross Hike', name_ka: 'გონიოს ჯვრის ლაშქრობა', desc_en: 'Coastal mountain hike near Batumi with views of the Black Sea and Gonio Fortress.', desc_ka: 'სანაპიროს მთის ლაშქრობა გონიოსთან.', difficulty: 'medium', region: 'Adjara', distance_km: 10, elevation_gain_m: 600, estimated_hours: 4, cover: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=800', checkpoints: [{ name: 'Gonio', type: 'landmark', idx: 0 }, { name: 'Cross Viewpoint', type: 'viewpoint', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000064', name_en: 'Chakvistavi Trail', name_ka: 'ჩაქვისთავის ბილიკი', desc_en: 'Subtropical forest trail near Batumi through tea plantations and lush greenery.', desc_ka: 'სუბტროპიკული ტყის ბილიკი ჩაქვისთავთან.', difficulty: 'easy', region: 'Adjara', distance_km: 6, elevation_gain_m: 250, estimated_hours: 2, cover: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800', checkpoints: [{ name: 'Chakvistavi', type: 'landmark', idx: 0 }, { name: 'Tea Plantation', type: 'viewpoint', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000065', name_en: 'Gobroneti Circular Hike', name_ka: 'გობრონეთის წრიული ლაშქრობა', desc_en: 'Circular hike through the forested hills of Gobroneti in highland Adjara.', desc_ka: 'წრიული ლაშქრობა გობრონეთში.', difficulty: 'medium', region: 'Adjara', distance_km: 12, elevation_gain_m: 600, estimated_hours: 5, cover: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800', checkpoints: [{ name: 'Gobroneti Start', type: 'landmark', idx: 0 }, { name: 'Gobroneti Ridge', type: 'viewpoint', idx: 0.5 }] },
  { id: 'a0000000-0000-0000-0000-000000000066', name_en: 'Kintrishi Nature Reserve Trail', name_ka: 'კინტრიშის ნაკრძალის ბილიკი', desc_en: 'Nature trail through the lush Kintrishi Nature Reserve in highland Adjara.', desc_ka: 'კინტრიშის ბუნების ნაკრძალის ბილიკი.', difficulty: 'medium', region: 'Adjara', distance_km: 14, elevation_gain_m: 700, estimated_hours: 6, cover: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800', checkpoints: [{ name: 'Reserve Entrance', type: 'landmark', idx: 0 }, { name: 'Kintrishi Forest', type: 'landmark', idx: 0.5 }] },
  { id: 'a0000000-0000-0000-0000-000000000067', name_en: 'Kintrishi to Tbikeli Lake', name_ka: 'კინტრიშიდან თბიკელის ტბამდე', desc_en: 'Mountain lake hike from Kintrishi valley to the alpine Tbikeli Lake.', desc_ka: 'კინტრიშიდან თბიკელის ტბამდე.', difficulty: 'hard', region: 'Adjara', distance_km: 20, elevation_gain_m: 1200, estimated_hours: 9, cover: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', checkpoints: [{ name: 'Kintrishi', type: 'landmark', idx: 0 }, { name: 'Tbikeli Lake', type: 'lake', idx: 0.95 }] },

  // IMERETI
  { id: 'a0000000-0000-0000-0000-000000000068', name_en: 'Kutaisi to Sataplia', name_ka: 'ქუთაისიდან სათაფლიამდე', desc_en: 'Easy walk from Kutaisi to Sataplia Nature Reserve with dinosaur footprints and caves.', desc_ka: 'ქუთაისიდან სათაფლიამდე გასეირნება.', difficulty: 'easy', region: 'Imereti', distance_km: 6, elevation_gain_m: 200, estimated_hours: 2, cover: 'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800', checkpoints: [{ name: 'Kutaisi', type: 'landmark', idx: 0 }, { name: 'Sataplia Reserve', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000069', name_en: 'Upper Krikhi Trail', name_ka: 'ზემო კრიხის ბილიკი', desc_en: 'Forest trail in the Krikhi area of Imereti with limestone formations.', desc_ka: 'ტყის ბილიკი კრიხის რაიონში.', difficulty: 'easy', region: 'Imereti', distance_km: 8, elevation_gain_m: 300, estimated_hours: 3, cover: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'Limestone Formations', type: 'landmark', idx: 0.5 }] },
  { id: 'a0000000-0000-0000-0000-000000000070', name_en: 'Sadmeli to Ritseuli Trail', name_ka: 'სადმელიდან რიცეულამდე', desc_en: 'Village connector trail through the green hills of Imereti.', desc_ka: 'სოფლების დამაკავშირებელი ბილიკი იმერეთში.', difficulty: 'easy', region: 'Imereti', distance_km: 6, elevation_gain_m: 200, estimated_hours: 2, cover: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', checkpoints: [{ name: 'Sadmeli', type: 'landmark', idx: 0 }, { name: 'Ritseuli', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000071', name_en: 'Chelishi Trail', name_ka: 'ჩელიშის ბილიკი', desc_en: 'Scenic walk through the Chelishi area in Imereti countryside.', desc_ka: 'ჩელიშის ბილიკი იმერეთში.', difficulty: 'easy', region: 'Imereti', distance_km: 5, elevation_gain_m: 150, estimated_hours: 2, cover: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'Chelishi', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000072', name_en: 'Adjameti Trail Route 2', name_ka: 'აჯამეთის ბილიკი 2', desc_en: 'Nature trail through the Adjameti Managed Reserve, home to rare Colchic forests.', desc_ka: 'აჯამეთის ნაკრძალის ბილიკი.', difficulty: 'easy', region: 'Imereti', distance_km: 7, elevation_gain_m: 200, estimated_hours: 2.5, cover: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800', checkpoints: [{ name: 'Adjameti Reserve', type: 'landmark', idx: 0 }, { name: 'Colchic Forest', type: 'landmark', idx: 0.5 }] },
  { id: 'a0000000-0000-0000-0000-000000000073', name_en: 'Adjameti Trail Route 3', name_ka: 'აჯამეთის ბილიკი 3', desc_en: 'Extended loop through the old-growth forest in Adjameti Reserve.', desc_ka: 'აჯამეთის ნაკრძალის გაფართოებული ბილიკი.', difficulty: 'easy', region: 'Imereti', distance_km: 9, elevation_gain_m: 250, estimated_hours: 3, cover: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800', checkpoints: [{ name: 'Reserve Gate', type: 'landmark', idx: 0 }, { name: 'Old Growth Forest', type: 'landmark', idx: 0.5 }] },
  { id: 'a0000000-0000-0000-0000-000000000074', name_en: 'Adjameti Trail Route 1', name_ka: 'აჯამეთის ბილიკი 1', desc_en: 'Short introductory trail in the Adjameti Managed Reserve.', desc_ka: 'აჯამეთის ნაკრძალის მოკლე ბილიკი.', difficulty: 'easy', region: 'Imereti', distance_km: 4, elevation_gain_m: 100, estimated_hours: 1.5, cover: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800', checkpoints: [{ name: 'Entrance', type: 'landmark', idx: 0 }, { name: 'Viewpoint', type: 'viewpoint', idx: 0.5 }] },

  // SAMTSKHE-JAVAKHETI
  { id: 'a0000000-0000-0000-0000-000000000075', name_en: 'Vardzia to Tmogvi Fortress', name_ka: 'ვარძიიდან თმოგვის ციხემდე', desc_en: 'Historic trail connecting the Vardzia cave monastery to the ruins of Tmogvi Fortress.', desc_ka: 'ისტორიული ბილიკი ვარძიიდან თმოგვის ციხემდე.', difficulty: 'medium', region: 'Samtskhe-Javakheti', distance_km: 8, elevation_gain_m: 500, estimated_hours: 3.5, cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', checkpoints: [{ name: 'Vardzia', type: 'landmark', idx: 0 }, { name: 'Tmogvi Fortress', type: 'ruins', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000076', name_en: 'Abastumani to Jaji Lake', name_ka: 'აბასთუმანიდან ჯაჯის ტბამდე', desc_en: 'Forest hike from the resort town of Abastumani to the scenic Jaji Lake.', desc_ka: 'აბასთუმანიდან ჯაჯის ტბამდე ლაშქრობა.', difficulty: 'medium', region: 'Samtskhe-Javakheti', distance_km: 12, elevation_gain_m: 700, estimated_hours: 5, cover: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', checkpoints: [{ name: 'Abastumani', type: 'landmark', idx: 0 }, { name: 'Jaji Lake', type: 'lake', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000077', name_en: 'Kartsachi Lake Trail', name_ka: 'ქარწახის ტბის ბილიკი', desc_en: 'Alpine lake hike to Kartsachi Lake near Abastumani.', desc_ka: 'ქარწახის ტბამდე ლაშქრობა.', difficulty: 'medium', region: 'Samtskhe-Javakheti', distance_km: 10, elevation_gain_m: 600, estimated_hours: 4.5, cover: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'Kartsachi Lake', type: 'lake', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000078', name_en: 'Jaji Lake to Ukhuti', name_ka: 'ჯაჯის ტბიდან უხუთამდე', desc_en: 'Continuation trail from Jaji Lake through forests to Ukhuti village.', desc_ka: 'ჯაჯის ტბიდან უხუთამდე ბილიკი.', difficulty: 'medium', region: 'Samtskhe-Javakheti', distance_km: 14, elevation_gain_m: 500, estimated_hours: 5, cover: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800', checkpoints: [{ name: 'Jaji Lake', type: 'lake', idx: 0 }, { name: 'Ukhuti', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000079', name_en: 'Baratkhevi Trail', name_ka: 'ბარათხევის ბილიკი', desc_en: 'Nature trail through the Baratkhevi valley in Samtskhe-Javakheti.', desc_ka: 'ბარათხევის ხეობის ბილიკი.', difficulty: 'easy', region: 'Samtskhe-Javakheti', distance_km: 6, elevation_gain_m: 250, estimated_hours: 2.5, cover: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'Valley End', type: 'viewpoint', idx: 0.95 }] },

  // RACHA / LECHKHUMI
  { id: 'a0000000-0000-0000-0000-000000000080', name_en: 'Zeskho to Ghebi', name_ka: 'ზესხოდან ღებამდე', desc_en: 'Remote mountain trail connecting Zeskho and Ghebi villages in Racha.', desc_ka: 'მთის ბილიკი ზესხოდან ღებამდე რაჭაში.', difficulty: 'hard', region: 'Racha', distance_km: 22, elevation_gain_m: 1300, estimated_hours: 10, cover: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800', checkpoints: [{ name: 'Zeskho', type: 'landmark', idx: 0 }, { name: 'Ghebi', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000081', name_en: 'Kelida Pass Trail', name_ka: 'კელიდას უღელტეხილის ბილიკი', desc_en: 'Mountain pass hike in the remote Racha highlands.', desc_ka: 'კელიდას უღელტეხილის ლაშქრობა რაჭაში.', difficulty: 'hard', region: 'Racha', distance_km: 18, elevation_gain_m: 1200, estimated_hours: 8, cover: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'Kelida Pass', type: 'pass', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000082', name_en: 'Kalitsadi Lake Trail', name_ka: 'კალიწადის ტბის ბილიკი', desc_en: 'Alpine lake hike to Kalitsadi Lake in Racha.', desc_ka: 'კალიწადის ტბამდე ლაშქრობა რაჭაში.', difficulty: 'medium', region: 'Racha', distance_km: 14, elevation_gain_m: 900, estimated_hours: 6, cover: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', checkpoints: [{ name: 'Trailhead', type: 'landmark', idx: 0 }, { name: 'Kalitsadi Lake', type: 'lake', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000083', name_en: 'Shaori Reservoir Trail', name_ka: 'შაორის წყალსაცავის ბილიკი', desc_en: 'Scenic walk around the beautiful Shaori Reservoir in Racha.', desc_ka: 'შაორის წყალსაცავის გარშემო გასეირნება.', difficulty: 'easy', region: 'Racha', distance_km: 8, elevation_gain_m: 200, estimated_hours: 3, cover: 'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'Reservoir Viewpoint', type: 'viewpoint', idx: 0.5 }] },
  { id: 'a0000000-0000-0000-0000-000000000084', name_en: 'Khvamli Mountain Trail', name_ka: 'ხვამლის მთის ბილიკი', desc_en: 'Hike to the legendary Khvamli Mountain, a flat-topped peak steeped in Georgian mythology.', desc_ka: 'ლაშქრობა ხვამლის მთაზე.', difficulty: 'hard', region: 'Racha', distance_km: 16, elevation_gain_m: 1100, estimated_hours: 7, cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', checkpoints: [{ name: 'Trailhead', type: 'landmark', idx: 0 }, { name: 'Khvamli Summit', type: 'summit', idx: 0.95 }] },

  // SAMEGRELO
  { id: 'a0000000-0000-0000-0000-000000000085', name_en: 'Kuakantsalia Trail', name_ka: 'კუაკანწალიას ბილიკი', desc_en: 'Nature trail in the Samegrelo region through lush Colchic forests.', desc_ka: 'კუაკანწალიას ბილიკი სამეგრელოში.', difficulty: 'easy', region: 'Samegrelo', distance_km: 6, elevation_gain_m: 200, estimated_hours: 2, cover: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'Forest Loop End', type: 'landmark', idx: 0.95 }] },

  // PANKISI
  { id: 'a0000000-0000-0000-0000-000000000086', name_en: 'Khadori to Makhvali Waterfall', name_ka: 'ხადორიდან მახვალის ჩანჩქერამდე', desc_en: 'Short hike from Khadori village to the scenic Makhvali Waterfall in Pankisi.', desc_ka: 'ლაშქრობა მახვალის ჩანჩქერამდე.', difficulty: 'easy', region: 'Kakheti', distance_km: 5, elevation_gain_m: 200, estimated_hours: 2, cover: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800', checkpoints: [{ name: 'Khadori', type: 'landmark', idx: 0 }, { name: 'Makhvali Waterfall', type: 'waterfall', idx: 0.95 }] },

  // TCT SEGMENTS
  { id: 'a0000000-0000-0000-0000-000000000087', name_en: 'TCT: Chuberi to Nakra', name_ka: 'TCT: ჩუბერიდან ნაკრამდე', desc_en: 'Transcaucasian Trail segment through remote valleys from Chuberi to Nakra. 27km.', desc_ka: 'ტრანსკავკასიური ბილიკი ჩუბერიდან ნაკრამდე.', difficulty: 'hard', region: 'Svaneti', distance_km: 27, elevation_gain_m: 1500, estimated_hours: 11, cover: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800', checkpoints: [{ name: 'Chuberi', type: 'landmark', idx: 0 }, { name: 'Nakra', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000088', name_en: 'TCT: Nakra to Becho', name_ka: 'TCT: ნაკრიდან ბეჩომდე', desc_en: 'Transcaucasian Trail segment with high pass crossing from Nakra to Becho. 35km.', desc_ka: 'ტრანსკავკასიური ბილიკი ნაკრიდან ბეჩომდე.', difficulty: 'hard', region: 'Svaneti', distance_km: 35, elevation_gain_m: 2000, estimated_hours: 14, cover: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', checkpoints: [{ name: 'Nakra', type: 'landmark', idx: 0 }, { name: 'High Pass', type: 'pass', idx: 0.5 }, { name: 'Becho', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000089', name_en: 'TCT: Becho to Mestia', name_ka: 'TCT: ბეჩოდან მესტიამდე', desc_en: 'Final Transcaucasian Trail segment in Svaneti arriving in Mestia. 21km.', desc_ka: 'ტრანსკავკასიური ბილიკი ბეჩოდან მესტიამდე.', difficulty: 'medium', region: 'Svaneti', distance_km: 21, elevation_gain_m: 1000, estimated_hours: 8, cover: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', checkpoints: [{ name: 'Becho', type: 'landmark', idx: 0 }, { name: 'Mestia', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000090', name_en: 'TCT: Imereti to Racha', name_ka: 'TCT: იმერეთიდან რაჭამდე', desc_en: 'Transcaucasian Trail segment crossing from Imereti into the Racha highlands.', desc_ka: 'ტრანსკავკასიური ბილიკი იმერეთიდან რაჭამდე.', difficulty: 'hard', region: 'Racha', distance_km: 30, elevation_gain_m: 1800, estimated_hours: 13, cover: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', checkpoints: [{ name: 'Imereti Start', type: 'landmark', idx: 0 }, { name: 'Border Pass', type: 'pass', idx: 0.5 }, { name: 'Racha End', type: 'landmark', idx: 0.95 }] },

  // OTHER
  { id: 'a0000000-0000-0000-0000-000000000091', name_en: 'Tsriokhi Fortress Trail', name_ka: 'წრიოხის ციხის ბილიკი', desc_en: 'Short hike to the medieval Tsriokhi Fortress ruins.', desc_ka: 'წრიოხის ციხის ნანგრევებამდე ლაშქრობა.', difficulty: 'easy', region: 'Imereti', distance_km: 4, elevation_gain_m: 200, estimated_hours: 1.5, cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'Tsriokhi Fortress', type: 'ruins', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000092', name_en: 'Trail to Gorijvari', name_ka: 'გორიჯვრის ბილიკი', desc_en: 'Hilltop hike to the Gorijvari church with panoramic valley views.', desc_ka: 'გორიჯვრის ეკლესიამდე ლაშქრობა.', difficulty: 'easy', region: 'Shida Kartli', distance_km: 4, elevation_gain_m: 200, estimated_hours: 1.5, cover: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=800', checkpoints: [{ name: 'Gori', type: 'landmark', idx: 0 }, { name: 'Gorijvari Church', type: 'church', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000093', name_en: 'Gorinamkali Trail', name_ka: 'გორინამკალის ბილიკი', desc_en: 'Nature trail through the Gorinamkali area with scenic river views.', desc_ka: 'გორინამკალის ბილიკი.', difficulty: 'easy', region: 'Imereti', distance_km: 5, elevation_gain_m: 150, estimated_hours: 2, cover: 'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'River Viewpoint', type: 'viewpoint', idx: 0.5 }] },
  { id: 'a0000000-0000-0000-0000-000000000094', name_en: 'Gogrulta Birkni Trail', name_ka: 'გოგრულთა ბირკნის ბილიკი', desc_en: 'Village trail through the rural Gogrulta area.', desc_ka: 'სოფლის ბილიკი გოგრულთაში.', difficulty: 'easy', region: 'Racha', distance_km: 6, elevation_gain_m: 200, estimated_hours: 2, cover: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800', checkpoints: [{ name: 'Gogrulta', type: 'landmark', idx: 0 }, { name: 'Birkni', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000095', name_en: 'Mount Borbalo Trail', name_ka: 'ბორბალოს მთის ბილიკი', desc_en: 'Summit trail to Mount Borbalo with views across Racha and beyond.', desc_ka: 'ბორბალოს მთის მწვერვალზე ასვლა.', difficulty: 'hard', region: 'Racha', distance_km: 18, elevation_gain_m: 1200, estimated_hours: 8, cover: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800', checkpoints: [{ name: 'Trailhead', type: 'landmark', idx: 0 }, { name: 'Mount Borbalo Summit', type: 'summit', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000096', name_en: 'Mokoland Trail', name_ka: 'მოქოლანდის ბილიკი', desc_en: 'Trail through the Mokoland area near Tbilisi.', desc_ka: 'მოქოლანდის ბილიკი თბილისთან.', difficulty: 'easy', region: 'Tbilisi', distance_km: 6, elevation_gain_m: 250, estimated_hours: 2, cover: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'Mokoland', type: 'landmark', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000097', name_en: 'Cross Mountain Trail', name_ka: 'ჯვრის მთის ბილიკი', desc_en: 'Short hike to a Cross Mountain viewpoint.', desc_ka: 'ჯვრის მთაზე ლაშქრობა.', difficulty: 'easy', region: 'Imereti', distance_km: 4, elevation_gain_m: 250, estimated_hours: 1.5, cover: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', checkpoints: [{ name: 'Start', type: 'landmark', idx: 0 }, { name: 'Cross Mountain', type: 'viewpoint', idx: 0.95 }] },
  { id: 'a0000000-0000-0000-0000-000000000098', name_en: 'Shepherds Trail by Ridge', name_ka: 'მწყემსების ბილიკი ქედზე', desc_en: 'Ridge walk along a traditional shepherds trail with mountain views.', desc_ka: 'ქედის გასწვრივ მწყემსების ბილიკი.', difficulty: 'medium', region: 'Borjomi-Kharagauli', distance_km: 12, elevation_gain_m: 600, estimated_hours: 5, cover: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', checkpoints: [{ name: 'Ridge Start', type: 'landmark', idx: 0 }, { name: 'Shepherd Camp', type: 'campsite', idx: 0.5 }] },
  { id: 'a0000000-0000-0000-0000-000000000099', name_en: 'Mukhuri to Khaishi', name_ka: 'მუხურიდან ხაიშამდე', desc_en: 'Epic long-distance trail from Mukhuri to Khaishi through Samegrelo wilderness. 78km.', desc_ka: 'გრძელი ბილიკი მუხურიდან ხაიშამდე.', difficulty: 'ultra', region: 'Samegrelo', distance_km: 78, elevation_gain_m: 4000, estimated_hours: 40, cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', checkpoints: [{ name: 'Mukhuri', type: 'landmark', idx: 0 }, { name: 'Midpoint Camp', type: 'campsite', idx: 0.5 }, { name: 'Khaishi', type: 'landmark', idx: 0.95 }] },
];

const ALL_TRAILS = [...ORIGINAL_TRAILS, ...NEW_TRAILS];

function esc(s) { return s.replace(/'/g, "''"); }

function buildSQL() {
  const lines = [];
  lines.push('-- Georgian Hiking Trails Seed Data');
  lines.push(`-- ${ALL_TRAILS.length} trails with REAL OSM GPS coordinates`);
  lines.push('-- Generated ' + new Date().toISOString().split('T')[0]);
  lines.push('');
  lines.push('TRUNCATE trail_reviews, trail_completions, checkpoint_completions, trail_checkpoints, trail_media, trails CASCADE;');
  lines.push('');

  let trailCount = 0;
  const insertedIds = [];

  // === TRAILS ===
  for (const trail of ALL_TRAILS) {
    const route = routeMap.get(trail.id);
    if (!route) {
      console.log(`SKIP ${trail.name_en} - no route data`);
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
    lines.push(`  '${trail.difficulty}', '${esc(trail.region)}', ${trail.distance_km}, ${trail.elevation_gain_m}, ${trail.estimated_hours},`);
    lines.push(`  ST_SetSRID(ST_MakePoint(${startCoord[0]}, ${startCoord[1]}), 4326),`);
    lines.push(`  ST_SetSRID(ST_MakePoint(${endCoord[0]}, ${endCoord[1]}), 4326),`);
    lines.push(`  ST_SetSRID(ST_MakeLine(ARRAY[`);
    lines.push(pointsSQL);
    lines.push(`  ]), 4326),`);
    lines.push(`  '${trail.cover}', true`);
    lines.push(`);`);
    lines.push('');

    trailCount++;
    insertedIds.push(trail.id);
  }

  // === MEDIA (3 images cycling through Unsplash) ===
  const unsplashImages = [
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

  lines.push('-- Trail Media');
  for (let t = 0; t < ALL_TRAILS.length; t++) {
    const trail = ALL_TRAILS[t];
    if (!insertedIds.includes(trail.id)) continue;
    for (let i = 0; i < 3; i++) {
      const imgIdx = (t * 3 + i) % unsplashImages.length;
      lines.push(`INSERT INTO trail_media (trail_id, type, url, caption, sort_order) VALUES ('${trail.id}', 'photo', '${unsplashImages[imgIdx]}', '${esc(trail.name_en)} - Photo ${i + 1}', ${i});`);
    }
  }
  lines.push('');

  // === CHECKPOINTS ===
  lines.push('-- Trail Checkpoints');
  for (const trail of ALL_TRAILS) {
    if (!insertedIds.includes(trail.id)) continue;
    const route = routeMap.get(trail.id);
    if (!route) continue;
    const coords = route.coordinates;

    for (let i = 0; i < trail.checkpoints.length; i++) {
      const cp = trail.checkpoints[i];
      const coordIdx = Math.min(Math.round(cp.idx * (coords.length - 1)), coords.length - 1);
      const [lon, lat] = coords[coordIdx];
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

  // === COMPLETIONS (spread across more trails) ===
  lines.push('-- Trail Completions');
  const completions = [
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 133],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 19],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 127],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 61],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000008', 36],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000011', 149],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000013', 15],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000035', 7],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 2],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 43],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 177],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000006', 96],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000009', 77],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000014', 30],
    ['b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 146],
    ['b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005', 93],
    ['b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000010', 141],
    ['b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000011', 125],
    ['b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000051', 50],
    ['b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 73],
    ['b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000006', 23],
    ['b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000007', 53],
    ['b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000041', 10],
  ];

  for (const [userId, trailId, daysAgo] of completions) {
    if (!insertedIds.includes(trailId)) continue;
    const route = routeMap.get(trailId);
    const endCoord = route ? route.coordinates[route.coordinates.length - 1] : [44.62, 42.66];
    lines.push(`INSERT INTO trail_completions (user_id, trail_id, proof_photo_url, photo_lat, photo_lng, status, completed_at) VALUES ('${userId}', '${trailId}', 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400', ${endCoord[1].toFixed(7)}, ${endCoord[0].toFixed(7)}, 'approved', NOW() - INTERVAL '${daysAgo} days');`);
  }
  lines.push(`UPDATE profiles SET total_trails_completed = 8 WHERE id = 'b0000000-0000-0000-0000-000000000001';`);
  lines.push(`UPDATE profiles SET total_trails_completed = 6 WHERE id = 'b0000000-0000-0000-0000-000000000002';`);
  lines.push(`UPDATE profiles SET total_trails_completed = 5 WHERE id = 'b0000000-0000-0000-0000-000000000003';`);
  lines.push(`UPDATE profiles SET total_trails_completed = 4 WHERE id = 'b0000000-0000-0000-0000-000000000004';`);
  lines.push('');

  // === REVIEWS ===
  lines.push('-- Trail Reviews');
  const reviewComments = [
    [4, 'Amazing trail! Views are breathtaking.'],
    [5, 'Well-maintained path, highly recommend.'],
    [4, 'Challenging but rewarding. Bring water.'],
    [5, 'One of the best hikes in Georgia!'],
    [3, 'Trail markings could be better but still enjoyable.'],
    [4, 'Beautiful scenery all the way.'],
  ];
  const reviews = [
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 0],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 1],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 2],
    ['b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000013', 3],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 5],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 1],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 2],
    ['b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000014', 0],
    ['b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 0],
    ['b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005', 4],
    ['b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000010', 2],
    ['b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000051', 3],
    ['b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 0],
    ['b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000006', 1],
    ['b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000007', 2],
    ['b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000041', 5],
  ];
  for (const [userId, trailId, commentIdx] of reviews) {
    if (!insertedIds.includes(trailId)) continue;
    const [rating, comment] = reviewComments[commentIdx];
    lines.push(`INSERT INTO trail_reviews (user_id, trail_id, rating, comment) VALUES ('${userId}', '${trailId}', ${rating}, '${esc(comment)}');`);
  }
  lines.push('');

  console.log(`\nGenerated ${trailCount} trails out of ${ALL_TRAILS.length} total`);
  console.log(`Skipped: ${ALL_TRAILS.length - trailCount}`);
  return lines.join('\n');
}

const sql = buildSQL();
const outputPath = path.join(__dirname, '..', 'supabase', 'seed.sql');
fs.writeFileSync(outputPath, sql);
console.log(`Wrote ${sql.length} chars (${sql.split('\n').length} lines) to ${outputPath}`);
