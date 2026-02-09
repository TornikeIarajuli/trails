const fs = require('fs');
const path = require('path');

const trails = [
  { name_en: 'Gergeti Trinity Church', name_ka: 'გერგეტის სამება', desc_en: 'Iconic hike to the 14th-century Gergeti Trinity Church perched at 2,170m with stunning views of Mount Kazbek.', desc_ka: 'საგზაო ბილიკი გერგეტის სამების ეკლესიამდე.', difficulty: 'easy', region: 'Kazbegi', distance: 6.0, elevation: 500, hours: 2.5, cover: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=800', route: [{lat:42.6598,lon:44.6198},{lat:42.6605,lon:44.6190},{lat:42.6610,lon:44.6183},{lat:42.6614,lon:44.6178},{lat:42.6618,lon:44.6174},{lat:42.6620,lon:44.6170},{lat:42.6622,lon:44.6168},{lat:42.6625,lon:44.6164},{lat:42.6627,lon:44.6159}] },
  { name_en: 'Mestia to Ushguli Trek', name_ka: 'მესტიიდან უშგულამდე', desc_en: 'Multi-day trek through Upper Svaneti, passing medieval Svan towers and glacier-fed rivers.', desc_ka: 'მრავალდღიანი ლაშქრობა ზემო სვანეთში.', difficulty: 'hard', region: 'Svaneti', distance: 58.0, elevation: 3200, hours: 28.0, cover: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', route: [{lat:43.0453,lon:42.7275},{lat:43.0380,lon:42.7400},{lat:43.0290,lon:42.7550},{lat:43.0200,lon:42.7800},{lat:43.0100,lon:42.8000},{lat:42.9950,lon:42.8200},{lat:42.9800,lon:42.8400},{lat:42.9650,lon:42.8600},{lat:42.9500,lon:42.8800},{lat:42.9350,lon:42.9000},{lat:42.9200,lon:42.9275}] },
  { name_en: 'Juta to Roshka (Abudelauri Lakes)', name_ka: 'ჯუთადან როშკამდე', desc_en: 'High-alpine crossing via colorful Abudelauri Lakes at 3,000m. Crosses Chaukhi Pass at 3,338m.', desc_ka: 'მაღალმთიანი გადასასვლელი აბუდელაურის ტბებით.', difficulty: 'hard', region: 'Kazbegi', distance: 26.0, elevation: 1800, hours: 10.0, cover: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', route: [{lat:42.5788,lon:44.5752},{lat:42.5760,lon:44.5720},{lat:42.5735,lon:44.5680},{lat:42.5710,lon:44.5640},{lat:42.5690,lon:44.5600},{lat:42.5670,lon:44.5560},{lat:42.5640,lon:44.5520},{lat:42.5600,lon:44.5460},{lat:42.5560,lon:44.5380},{lat:42.5520,lon:44.5300},{lat:42.5500,lon:44.5200}] },
  { name_en: 'Omalo to Dartlo', name_ka: 'ომალოდან დართლომდე', desc_en: 'Beautiful day hike through remote Tusheti connecting two medieval fortress villages.', desc_ka: 'ლაშქრობა თუშეთის რეგიონში.', difficulty: 'medium', region: 'Tusheti', distance: 14.0, elevation: 650, hours: 5.0, cover: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', route: [{lat:42.3933,lon:45.6325},{lat:42.3950,lon:45.6280},{lat:42.3970,lon:45.6220},{lat:42.3990,lon:45.6160},{lat:42.4010,lon:45.6100},{lat:42.4030,lon:45.6040},{lat:42.4060,lon:45.5960},{lat:42.4080,lon:45.5900},{lat:42.4100,lon:45.5850}] },
  { name_en: 'Truso Valley', name_ka: 'თრუსოს ხეობა', desc_en: 'Scenic valley walk along the Terek River past travertine pools and abandoned villages.', desc_ka: 'ხეობის გასეირნება თერგის მდინარის გასწვრივ.', difficulty: 'easy', region: 'Kazbegi', distance: 24.0, elevation: 400, hours: 6.0, cover: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800', route: [{lat:42.5550,lon:44.5800},{lat:42.5570,lon:44.5720},{lat:42.5600,lon:44.5640},{lat:42.5630,lon:44.5550},{lat:42.5660,lon:44.5460},{lat:42.5690,lon:44.5370},{lat:42.5720,lon:44.5280},{lat:42.5760,lon:44.5100},{lat:42.5800,lon:44.4900}] },
  { name_en: 'Lagodekhi Waterfall Trail', name_ka: 'ლაგოდეხის ჩანჩქერი', desc_en: 'Easy nature walk through old-growth forest to a beautiful waterfall in Lagodekhi Protected Areas.', desc_ka: 'ბუნების გასეირნება ლაგოდეხში.', difficulty: 'easy', region: 'Kakheti', distance: 14.0, elevation: 300, hours: 4.0, cover: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800', route: [{lat:41.8280,lon:46.2840},{lat:41.8310,lon:46.2870},{lat:41.8340,lon:46.2910},{lat:41.8370,lon:46.2950},{lat:41.8400,lon:46.2990},{lat:41.8430,lon:46.3020},{lat:41.8460,lon:46.3060},{lat:41.8500,lon:46.3100}] },
  { name_en: "Borjomi-Kharagauli: Likani Trail", name_ka: 'ბორჯომ-ხარაგაული: ლიკანი', desc_en: "Day hike in one of Europe's largest national parks through mixed forests to alpine meadows.", desc_ka: 'ლაშქრობა ეროვნულ პარკში.', difficulty: 'medium', region: 'Borjomi-Kharagauli', distance: 18.0, elevation: 1100, hours: 7.0, cover: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800', route: [{lat:41.8370,lon:43.4060},{lat:41.8340,lon:43.4010},{lat:41.8310,lon:43.3950},{lat:41.8270,lon:43.3880},{lat:41.8230,lon:43.3800},{lat:41.8190,lon:43.3720},{lat:41.8150,lon:43.3630},{lat:41.8100,lon:43.3500}] },
  { name_en: 'Chaukhi Pass', name_ka: 'ჩაუხის უღელტეხილი', desc_en: 'Challenging high-altitude pass crossing at 3,338m with dramatic rock spires.', desc_ka: 'მაღალმთიანი უღელტეხილი 3,338 მ-ზე.', difficulty: 'ultra', region: 'Kazbegi', distance: 16.0, elevation: 1500, hours: 9.0, cover: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800', route: [{lat:42.5780,lon:44.5750},{lat:42.5765,lon:44.5720},{lat:42.5750,lon:44.5690},{lat:42.5738,lon:44.5660},{lat:42.5725,lon:44.5630},{lat:42.5710,lon:44.5590},{lat:42.5695,lon:44.5550},{lat:42.5680,lon:44.5500},{lat:42.5665,lon:44.5440},{lat:42.5650,lon:44.5350}] },
  { name_en: 'Martvili Canyon Trail', name_ka: 'მარტვილის კანიონი', desc_en: 'Short but stunning walk along the turquoise Abasha River canyon with cliff walkways.', desc_ka: 'აბაშის მდინარის კანიონის გასეირნება.', difficulty: 'easy', region: 'Samegrelo', distance: 3.0, elevation: 50, hours: 1.0, cover: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800', route: [{lat:42.4560,lon:42.3780},{lat:42.4568,lon:42.3790},{lat:42.4575,lon:42.3800},{lat:42.4582,lon:42.3810},{lat:42.4590,lon:42.3820}] },
  { name_en: 'Okatse Canyon Trail', name_ka: 'ოკაცეს კანიონი', desc_en: 'Thrilling walk on a metal walkway suspended over the 100m deep Okatse Canyon.', desc_ka: 'ოკაცეს კანიონზე გაკიდებული ლითონის ბილიკი.', difficulty: 'easy', region: 'Imereti', distance: 7.0, elevation: 200, hours: 2.5, cover: 'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800', route: [{lat:42.3850,lon:42.4340},{lat:42.3865,lon:42.4360},{lat:42.3880,lon:42.4380},{lat:42.3895,lon:42.4400},{lat:42.3910,lon:42.4430},{lat:42.3920,lon:42.4450}] },
  { name_en: 'Shatili to Mutso', name_ka: 'შატილიდან მუწომდე', desc_en: 'Remote trek in Khevsureti connecting two medieval fortress villages through the Argun Gorge.', desc_ka: 'ლაშქრობა ხევსურეთში.', difficulty: 'hard', region: 'Khevsureti', distance: 12.0, elevation: 800, hours: 5.0, cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', route: [{lat:42.6250,lon:45.1750},{lat:42.6270,lon:45.1800},{lat:42.6290,lon:45.1860},{lat:42.6310,lon:45.1920},{lat:42.6330,lon:45.1980},{lat:42.6350,lon:45.2030},{lat:42.6380,lon:45.2060},{lat:42.6400,lon:45.2100}] },
  { name_en: 'Tobavarchkhili (Silver Lake)', name_ka: 'ტობავარჩხილი', desc_en: 'Multi-day expedition to the legendary Silver Lake hidden in remote forests west of Kutaisi.', desc_ka: 'ექსპედიცია ვერცხლის ტბამდე.', difficulty: 'ultra', region: 'Samegrelo', distance: 44.0, elevation: 2800, hours: 24.0, cover: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', route: [{lat:42.5200,lon:42.1500},{lat:42.5240,lon:42.1420},{lat:42.5280,lon:42.1340},{lat:42.5320,lon:42.1260},{lat:42.5360,lon:42.1180},{lat:42.5400,lon:42.1100},{lat:42.5440,lon:42.1020},{lat:42.5490,lon:42.0940},{lat:42.5540,lon:42.0860},{lat:42.5600,lon:42.0800}] },
];

const trailIds = trails.map((_, i) => `'a0000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}'`);
const testUsers = [
  { id: 'b0000000-0000-0000-0000-000000000001', username: 'mountain_nika', name: 'Nika Gelashvili', bio: 'Mountain enthusiast from Tbilisi. Conquered 50+ peaks across the Caucasus.' },
  { id: 'b0000000-0000-0000-0000-000000000002', username: 'hiking_mari', name: 'Mariam Kvaratskhelia', bio: 'Nature photographer and trail runner. Svaneti is my second home.' },
  { id: 'b0000000-0000-0000-0000-000000000003', username: 'george_adventures', name: 'Giorgi Beridze', bio: 'Weekend warrior. Exploring every corner of Georgia one trail at a time.' },
  { id: 'b0000000-0000-0000-0000-000000000004', username: 'tea_on_trail', name: 'Teona Mikadze', bio: 'Slow hiker, fast photographer. Always carry tea to the summit.' },
];

const imgUrls = [
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

const cpTypes = ['viewpoint','landmark','water_source','church','lake','waterfall','summit','bridge','ruins','pass'];
const comments = ['Amazing trail! Views are breathtaking.','Well-maintained path, highly recommend.','Challenging but rewarding. Bring water.','One of the best hikes in Georgia!','Beautiful scenery, moderate difficulty.','Perfect weekend hike.'];

function esc(s) { return s.replace(/'/g, "''"); }

let sql = `-- Georgian Hiking Trails Seed Data
-- 12 trails, media, checkpoints, 4 test users, completions, reviews

TRUNCATE trail_reviews, trail_completions, checkpoint_completions, trail_checkpoints, trail_media, trails CASCADE;

`;

// Trails
for (let i = 0; i < trails.length; i++) {
  const t = trails[i];
  const s = t.route[0], e = t.route[t.route.length - 1];
  const pts = t.route.map(c => `ST_MakePoint(${c.lon.toFixed(6)}, ${c.lat.toFixed(6)})`).join(',\n    ');
  sql += `INSERT INTO trails (id, name_en, name_ka, description_en, description_ka, difficulty, region, distance_km, elevation_gain_m, estimated_hours, start_point, end_point, route, cover_image_url, is_published) VALUES (
  ${trailIds[i]},
  '${esc(t.name_en)}', '${esc(t.name_ka)}',
  '${esc(t.desc_en)}',
  '${esc(t.desc_ka)}',
  '${t.difficulty}', '${t.region}', ${t.distance}, ${t.elevation}, ${t.hours},
  ST_SetSRID(ST_MakePoint(${s.lon.toFixed(6)}, ${s.lat.toFixed(6)}), 4326),
  ST_SetSRID(ST_MakePoint(${e.lon.toFixed(6)}, ${e.lat.toFixed(6)}), 4326),
  ST_SetSRID(ST_MakeLine(ARRAY[
    ${pts}
  ]), 4326),
  '${t.cover}', true
);\n\n`;
}

// Media
sql += '-- Trail Media\n';
for (let i = 0; i < trails.length; i++) {
  for (let j = 0; j < 3; j++) {
    sql += `INSERT INTO trail_media (trail_id, type, url, caption, sort_order) VALUES (${trailIds[i]}, 'photo', '${imgUrls[(i + j) % imgUrls.length]}', '${esc(trails[i].name_en)} - Photo ${j + 1}', ${j});\n`;
  }
}

// Checkpoints
sql += '\n-- Trail Checkpoints\n';
for (let i = 0; i < trails.length; i++) {
  const r = trails[i].route;
  const nc = Math.min(3, Math.max(2, Math.floor(r.length / 3)));
  for (let c = 0; c < nc; c++) {
    const pt = r[Math.min(Math.floor((c + 1) * r.length / (nc + 1)), r.length - 1)];
    sql += `INSERT INTO trail_checkpoints (trail_id, name_en, type, coordinates, sort_order, is_checkable) VALUES (${trailIds[i]}, '${esc(trails[i].name_en)} CP${c + 1}', '${cpTypes[(i + c) % cpTypes.length]}', ST_SetSRID(ST_MakePoint(${pt.lon.toFixed(6)}, ${pt.lat.toFixed(6)}), 4326), ${c}, true);\n`;
  }
}

// Test user profiles
sql += '\n-- Test Users\n';
for (const u of testUsers) {
  sql += `INSERT INTO profiles (id, username, full_name, bio, total_trails_completed) VALUES ('${u.id}', '${u.username}', '${u.name}', '${esc(u.bio)}', 0) ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username, full_name=EXCLUDED.full_name, bio=EXCLUDED.bio;\n`;
}

// Completions
sql += '\n-- Trail Completions\n';
const assigns = [
  { uid: testUsers[0].id, tis: [0, 1, 2, 4, 7, 10], cnt: 6 },
  { uid: testUsers[1].id, tis: [0, 1, 3, 5, 8], cnt: 5 },
  { uid: testUsers[2].id, tis: [0, 4, 9, 10], cnt: 4 },
  { uid: testUsers[3].id, tis: [0, 5, 6], cnt: 3 },
];

for (const a of assigns) {
  for (const ti of a.tis) {
    if (ti >= trails.length) continue;
    const mp = trails[ti].route[Math.floor(trails[ti].route.length / 2)];
    const da = Math.floor(Math.random() * 180) + 1;
    sql += `INSERT INTO trail_completions (user_id, trail_id, proof_photo_url, photo_lat, photo_lng, status, completed_at) VALUES ('${a.uid}', ${trailIds[ti]}, 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400', ${mp.lat.toFixed(7)}, ${mp.lon.toFixed(7)}, 'approved', NOW() - INTERVAL '${da} days');\n`;
  }
  sql += `UPDATE profiles SET total_trails_completed = ${a.cnt} WHERE id = '${a.uid}';\n`;
}

// Reviews
sql += '\n-- Trail Reviews\n';
for (const a of assigns) {
  for (let j = 0; j < Math.min(3, a.tis.length); j++) {
    const ti = a.tis[j];
    if (ti >= trails.length) continue;
    const rating = 4 + (j % 2);
    sql += `INSERT INTO trail_reviews (user_id, trail_id, rating, comment) VALUES ('${a.uid}', ${trailIds[ti]}, ${rating}, '${comments[(j + a.tis[0]) % comments.length]}');\n`;
  }
}

const outPath = path.join(__dirname, '..', 'supabase', 'seed.sql');
fs.writeFileSync(outPath, sql, 'utf-8');
console.log(`Seed SQL written to: ${outPath}`);
console.log(`  - ${trails.length} trails with route geometry + cover images`);
console.log(`  - ${trails.length * 3} trail media entries`);
console.log(`  - Checkpoints for each trail`);
console.log(`  - ${testUsers.length} test users with profiles`);
console.log(`  - ${assigns.reduce((s, a) => s + a.tis.length, 0)} trail completions`);
console.log(`  - Trail reviews`);
